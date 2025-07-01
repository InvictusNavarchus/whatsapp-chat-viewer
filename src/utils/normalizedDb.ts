import { Chat, Message, BookmarkedMessage } from '@/types/chat';
import { performanceMonitor } from './performance';
import log from 'loglevel';

const logger = log.getLogger('normalizedDb');
logger.setLevel('debug');

const DB_NAME = 'whatsapp-viewer-v2';
const DB_VERSION = 2;

// Store names
const STORES = {
  CHATS: 'chats',
  MESSAGES: 'messages', 
  BOOKMARKS: 'bookmarks',
  METADATA: 'metadata'
} as const;

// Database interface types
interface ChatRecord {
  id: string;
  name: string;
  createdAt: Date;
  lastMessageTime: string;
  messageCount: number;
  participantCount: number;
  participants: string[];
}

interface MessageRecord {
  id: string;
  chatId: string;
  date: string;
  time: string;
  sender: string;
  content: string;
  isSystemMessage: boolean;
  timestamp: number; // For efficient sorting
}

interface BookmarkRecord {
  id: string; // messageId
  chatId: string;
  createdAt: Date;
  
  // Denormalized data to avoid expensive joins
  sender: string;
  content: string;
  date: string;
  time: string;
  chatName: string;
  isSystemMessage: boolean;
}

interface MetadataRecord {
  key: string;
  value: unknown;
  updatedAt: Date;
}

let db: IDBDatabase | null = null;

/**
 * Initialize the normalized IndexedDB database with proper schema
 * Creates separate stores for chats, messages, bookmarks, and metadata
 */
const initNormalizedDB = (): Promise<IDBDatabase> => {
  logger.debug('💾 [UTIL] initNormalizedDB function called');
  return new Promise((resolve, reject) => {
    if (db) {
      logger.debug('💾 [UTIL] db already exists');
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      logger.debug('💾 [UTIL] db initialized');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      const transaction = (event.target as IDBOpenDBRequest).transaction!;
      const oldVersion = event.oldVersion;
      
      // Create chats store
      if (!database.objectStoreNames.contains(STORES.CHATS)) {
        const chatStore = database.createObjectStore(STORES.CHATS, { keyPath: 'id' });
        chatStore.createIndex('name', 'name', { unique: false });
        chatStore.createIndex('createdAt', 'createdAt', { unique: false });
        chatStore.createIndex('lastMessageTime', 'lastMessageTime', { unique: false });
        chatStore.createIndex('messageCount', 'messageCount', { unique: false });
      }

      // Create messages store
      if (!database.objectStoreNames.contains(STORES.MESSAGES)) {
        const messageStore = database.createObjectStore(STORES.MESSAGES, { keyPath: 'id' });
        messageStore.createIndex('chatId', 'chatId', { unique: false });
        messageStore.createIndex('sender', 'sender', { unique: false });
        messageStore.createIndex('timestamp', 'timestamp', { unique: false });
        messageStore.createIndex('date', 'date', { unique: false });
        messageStore.createIndex('isSystemMessage', 'isSystemMessage', { unique: false });
        messageStore.createIndex('chatId_timestamp', ['chatId', 'timestamp'], { unique: false });
        messageStore.createIndex('chatId_sender', ['chatId', 'sender'], { unique: false });
      }

      // Handle bookmarks store migration
      if (oldVersion < 2) {
        // Migration from v1 to v2: Convert normalized bookmarks to denormalized
        if (database.objectStoreNames.contains(STORES.BOOKMARKS)) {
          // Delete old bookmarks store
          database.deleteObjectStore(STORES.BOOKMARKS);
        }
        
        // Create new denormalized bookmarks store
        const bookmarkStore = database.createObjectStore(STORES.BOOKMARKS, { keyPath: 'id' });
        bookmarkStore.createIndex('chatId', 'chatId', { unique: false });
        bookmarkStore.createIndex('createdAt', 'createdAt', { unique: false });
        bookmarkStore.createIndex('chatId_createdAt', ['chatId', 'createdAt'], { unique: false });
        bookmarkStore.createIndex('sender', 'sender', { unique: false });
        bookmarkStore.createIndex('date', 'date', { unique: false });
        
        logger.info('🔄 [DB] Migrated bookmarks store to denormalized format');
      } else if (!database.objectStoreNames.contains(STORES.BOOKMARKS)) {
        // Create bookmarks store for new installations
        const bookmarkStore = database.createObjectStore(STORES.BOOKMARKS, { keyPath: 'id' });
        bookmarkStore.createIndex('chatId', 'chatId', { unique: false });
        bookmarkStore.createIndex('createdAt', 'createdAt', { unique: false });
        bookmarkStore.createIndex('chatId_createdAt', ['chatId', 'createdAt'], { unique: false });
        bookmarkStore.createIndex('sender', 'sender', { unique: false });
        bookmarkStore.createIndex('date', 'date', { unique: false });
      }

      // Create metadata store
      if (!database.objectStoreNames.contains(STORES.METADATA)) {
        const metadataStore = database.createObjectStore(STORES.METADATA, { keyPath: 'key' });
        metadataStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
  });
};

/**
 * Save a chat's metadata (without messages)
 */
export const saveChatMetadata = async (chat: Chat): Promise<void> => {
  logger.debug('💾 [UTIL] saveChatMetadata function called');
  performanceMonitor.startTimer('saveChatMetadata');
  
  try {
    const database = await initNormalizedDB();
    const transaction = database.transaction([STORES.CHATS], 'readwrite');
    const store = transaction.objectStore(STORES.CHATS);
    
    // Create participants array from messages
    const participants = [...new Set(
      chat.messages
        .filter(m => !m.isSystemMessage)
        .map(m => m.sender)
    )];
    
    const chatRecord: ChatRecord = {
      id: chat.id,
      name: chat.name,
      createdAt: chat.createdAt,
      lastMessageTime: chat.lastMessageTime,
      messageCount: chat.messages.length,
      participantCount: participants.length,
      participants
    };
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(chatRecord);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    logger.error('💾 [DB] Failed to save chat metadata:', error);
    throw error;
  } finally {
    performanceMonitor.endTimer('saveChatMetadata');
    logger.debug('💾 [UTIL] saveChatMetadata function completed');
  }
};

/**
 * Validate and parse timestamp from date and time strings
 */
const parseTimestamp = (date: string, time: string): number => {
  // Basic validation for date format (DD/MM/YYYY or MM/DD/YYYY or YYYY-MM-DD)
  const dateRegex = /^\d{1,2}[/-]\d{1,2}[/-]\d{4}$|^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/;
  // Basic validation for time format (HH:MM or HH:MM:SS, with optional AM/PM)
  const timeRegex = /^\d{1,2}:\d{2}(:\d{2})?(\s?(AM|PM))?$/i;
  
  if (!dateRegex.test(date.trim())) {
    logger.warn('📅 [DB] Invalid date format:', date);
    return Date.now();
  }
  
  if (!timeRegex.test(time.trim())) {
    logger.warn('⏰ [DB] Invalid time format:', time);
    return Date.now();
  }
  
  const timestamp = new Date(`${date} ${time}`).getTime();
  
  if (isNaN(timestamp)) {
    logger.warn('❓ [DB] Failed to parse timestamp from date:', date, 'time:', time);
    return Date.now();
  }
  
  return timestamp;
};

/**
 * Save messages for a chat
 */
export const saveChatMessages = async (chatId: string, messages: Message[]): Promise<void> => {
  logger.debug('💾 [UTIL] saveChatMessages function called');
  performanceMonitor.startTimer('saveChatMessages');
  
  try {
    const database = await initNormalizedDB();
    const transaction = database.transaction([STORES.MESSAGES], 'readwrite');
    const store = transaction.objectStore(STORES.MESSAGES);
    
    // Convert messages to normalized format with validated timestamps
    const messageRecords: MessageRecord[] = messages.map(message => ({
      id: message.id,
      chatId,
      date: message.date,
      time: message.time,
      sender: message.sender,
      content: message.content,
      isSystemMessage: message.isSystemMessage,
      timestamp: parseTimestamp(message.date, message.time)
    }));
    
    // Save all messages
    await Promise.all(
      messageRecords.map(record => 
        new Promise<void>((resolve, reject) => {
          const request = store.put(record);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        })
      )
    );
  } catch (error) {
    logger.error('💾 [DB] Failed to save chat messages:', error);
    throw error;
  } finally {
    performanceMonitor.endTimer('saveChatMessages');
    logger.debug('💾 [UTIL] saveChatMessages function completed');
  }
};

/**
 * Save a complete chat (metadata + messages)
 */
export const saveChat = async (chat: Chat): Promise<void> => {
  logger.debug('💾 [UTIL] saveChat function called');
  performanceMonitor.startTimer('saveChat');
  
  try {
    // Save metadata and messages in parallel
    await Promise.all([
      saveChatMetadata(chat),
      saveChatMessages(chat.id, chat.messages)
    ]);
  } catch (error) {
    logger.error('💾 [DB] Failed to save chat:', error);
    throw error;
  } finally {
    performanceMonitor.endTimer('saveChat');
    logger.debug('💾 [UTIL] saveChat function completed');
  }
};

/**
 * Load chat metadata (without messages)
 */
export const loadChatMetadata = async (chatId: string): Promise<ChatRecord | null> => {
  logger.debug('💾 [UTIL] loadChatMetadata function called');
  performanceMonitor.startTimer('loadChatMetadata');
  
  try {
    const database = await initNormalizedDB();
    const transaction = database.transaction([STORES.CHATS], 'readonly');
    const store = transaction.objectStore(STORES.CHATS);
    
    return new Promise<ChatRecord | null>((resolve, reject) => {
      const request = store.get(chatId);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? { ...result, createdAt: new Date(result.createdAt) } : null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    logger.error('💾 [DB] Failed to load chat metadata:', error);
    return null;
  } finally {
    performanceMonitor.endTimer('loadChatMetadata');
    logger.debug('💾 [UTIL] loadChatMetadata function completed');
  }
};

/**
 * Load all chat metadata (for chat list)
 */
export const loadAllChatMetadata = async (): Promise<ChatRecord[]> => {
  logger.debug('💾 [UTIL] loadAllChatMetadata function called');
  performanceMonitor.startTimer('loadAllChatMetadata');
  
  try {
    const database = await initNormalizedDB();
    const transaction = database.transaction([STORES.CHATS], 'readonly');
    const store = transaction.objectStore(STORES.CHATS);
    
    return new Promise<ChatRecord[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const results = request.result.map((chat: ChatRecord) => ({
          ...chat,
          createdAt: new Date(chat.createdAt)
        }));
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    logger.error('💾 [DB] Failed to load all chat metadata:', error);
    return [];
  } finally {
    performanceMonitor.endTimer('loadAllChatMetadata');
    logger.debug('💾 [UTIL] loadAllChatMetadata function completed');
  }
};

/**
 * Load messages for a chat with pagination
 */
export const loadChatMessages = async (
  chatId: string, 
  limit?: number, 
  offset?: number
): Promise<Message[]> => {
  logger.debug('💾 [UTIL] loadChatMessages function called');
  performanceMonitor.startTimer('loadChatMessages');
  
  try {
    const database = await initNormalizedDB();
    const transaction = database.transaction([STORES.MESSAGES], 'readonly');
    const store = transaction.objectStore(STORES.MESSAGES);
    const index = store.index('chatId_timestamp');
    
    return new Promise<Message[]>((resolve, reject) => {
      const range = IDBKeyRange.bound([chatId, 0], [chatId, Date.now()]);
      const request = index.getAll(range);
      
      request.onsuccess = () => {
        let messages = request.result.map((record: MessageRecord) => ({
          id: record.id,
          date: record.date,
          time: record.time,
          sender: record.sender,
          content: record.content,
          isBookmarked: false, // Will be populated separately
          isSystemMessage: record.isSystemMessage
        }));
        
        // Apply pagination if specified
        if (offset !== undefined) {
          messages = messages.slice(offset);
        }
        if (limit !== undefined) {
          messages = messages.slice(0, limit);
        }
        
        resolve(messages);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    logger.error('💾 [DB] Failed to load chat messages:', error);
    return [];
  } finally {
    performanceMonitor.endTimer('loadChatMessages');
    logger.debug('💾 [UTIL] loadChatMessages function completed');
  }
};

/**
 * Load a complete chat (metadata + messages)
 */
export const loadChat = async (chatId: string): Promise<Chat | null> => {
  logger.debug('💾 [UTIL] loadChat function called');
  performanceMonitor.startTimer('loadChat');
  
  try {
    const [metadata, messages] = await Promise.all([
      loadChatMetadata(chatId),
      loadChatMessages(chatId)
    ]);
    
    if (!metadata) return null;
    
    return {
      id: metadata.id,
      name: metadata.name,
      messages,
      createdAt: metadata.createdAt,
      lastMessageTime: metadata.lastMessageTime
    };
  } catch (error) {
    logger.error('💾 [DB] Failed to load chat:', error);
    return null;
  } finally {
    performanceMonitor.endTimer('loadChat');
    logger.debug('💾 [UTIL] loadChat function completed');
  }
};

/**
 * Save a bookmark with denormalized data for fast retrieval
 */
export const saveBookmark = async (
  messageId: string,
  chatId: string,
  messageData: {
    sender: string;
    content: string;
    date: string;
    time: string;
    isSystemMessage: boolean;
  },
  chatName: string
): Promise<void> => {
  logger.debug('💾 [UTIL] saveBookmark function called');
  performanceMonitor.startTimer('saveBookmark');
  
  try {
    const database = await initNormalizedDB();
    const transaction = database.transaction([STORES.BOOKMARKS], 'readwrite');
    const store = transaction.objectStore(STORES.BOOKMARKS);
    
    const bookmark: BookmarkRecord = {
      id: messageId,
      chatId,
      createdAt: new Date(),
      sender: messageData.sender,
      content: messageData.content,
      date: messageData.date,
      time: messageData.time,
      chatName,
      isSystemMessage: messageData.isSystemMessage
    };
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(bookmark);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    logger.error('💾 [DB] Failed to save bookmark:', error);
    throw error;
  } finally {
    performanceMonitor.endTimer('saveBookmark');
    logger.debug('💾 [UTIL] saveBookmark function completed');
  }
};

/**
 * Remove a bookmark
 */
export const removeBookmark = async (messageId: string): Promise<void> => {
  logger.debug('💾 [UTIL] removeBookmark function called');
  performanceMonitor.startTimer('removeBookmark');
  
  try {
    const database = await initNormalizedDB();
    const transaction = database.transaction([STORES.BOOKMARKS], 'readwrite');
    const store = transaction.objectStore(STORES.BOOKMARKS);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(messageId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    logger.error('💾 [DB] Failed to remove bookmark:', error);
    throw error;
  } finally {
    performanceMonitor.endTimer('removeBookmark');
    logger.debug('💾 [UTIL] removeBookmark function completed');
  }
};

/**
 * Load all bookmarks with denormalized data (fast, single query)
 */
export const loadBookmarks = async (): Promise<BookmarkedMessage[]> => {
  logger.debug('💾 [UTIL] loadBookmarks function called');
  performanceMonitor.startTimer('loadBookmarks');
  
  try {
    const database = await initNormalizedDB();
    // Fast transaction - only includes BOOKMARKS store, not MESSAGES or CHATS
    const transaction = database.transaction([STORES.BOOKMARKS], 'readonly');
    const bookmarkStore = transaction.objectStore(STORES.BOOKMARKS);
    
    // Single, fast query - no joins needed
    const bookmarkRecords = await new Promise<BookmarkRecord[]>((resolve, reject) => {
      const request = bookmarkStore.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    // Convert denormalized bookmark records to BookmarkedMessage format
    const bookmarks: BookmarkedMessage[] = bookmarkRecords.map(bookmark => ({
      id: bookmark.id,
      date: bookmark.date,
      time: bookmark.time,
      sender: bookmark.sender,
      content: bookmark.content,
      isBookmarked: true,
      isSystemMessage: bookmark.isSystemMessage,
      chatId: bookmark.chatId,
      chatName: bookmark.chatName
    }));
    
    // Sort by bookmark creation date (newest first)
    return bookmarks.sort((a, b) => {
      const bookmarkA = bookmarkRecords.find(br => br.id === a.id);
      const bookmarkB = bookmarkRecords.find(br => br.id === b.id);
      
      // Handle cases where bookmarks might not be found
      if (!bookmarkA && !bookmarkB) return 0;
      if (!bookmarkA) return 1; // Move to end
      if (!bookmarkB) return -1; // Move to beginning
      
      return bookmarkB.createdAt.getTime() - bookmarkA.createdAt.getTime();
    });
  } catch (error) {
    logger.error('💾 [DB] Failed to load bookmarks:', error);
    return [];
  } finally {
    performanceMonitor.endTimer('loadBookmarks');
    logger.debug('💾 [UTIL] loadBookmarks function completed');
  }
};

/**
 * Check if a message is bookmarked
 */
export const isMessageBookmarked = async (messageId: string): Promise<boolean> => {
  logger.debug('💾 [UTIL] isMessageBookmarked function called');
  performanceMonitor.startTimer('isMessageBookmarked');
  
  try {
    const database = await initNormalizedDB();
    const transaction = database.transaction([STORES.BOOKMARKS], 'readonly');
    const store = transaction.objectStore(STORES.BOOKMARKS);
    
    return new Promise<boolean>((resolve, reject) => {
      const request = store.get(messageId);
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    logger.error('🔖 [DB] Failed to check bookmark status:', error);
    return false;
  } finally {
    performanceMonitor.endTimer('isMessageBookmarked');
    logger.debug('💾 [UTIL] isMessageBookmarked function completed');
  }
};

/**
 * Get bookmark status for multiple messages at once
 */
export const getBookmarkStatus = async (messageIds: string[]): Promise<Record<string, boolean>> => {
  logger.debug('💾 [UTIL] getBookmarkStatus function called');
  performanceMonitor.startTimer('getBookmarkStatus');
  
  try {
    const database = await initNormalizedDB();
    const transaction = database.transaction([STORES.BOOKMARKS], 'readonly');
    const store = transaction.objectStore(STORES.BOOKMARKS);
    
    const statuses = await Promise.all(
      messageIds.map(async (messageId) => {
        const isBookmarked = await new Promise<boolean>((resolve, reject) => {
          const request = store.get(messageId);
          request.onsuccess = () => resolve(!!request.result);
          request.onerror = () => reject(request.error);
        });
        return [messageId, isBookmarked] as const;
      })
    );
    
    return Object.fromEntries(statuses);
  } catch (error) {
    logger.error('🔖 [DB] Failed to get bookmark status:', error);
    return {};
  } finally {
    performanceMonitor.endTimer('getBookmarkStatus');
    logger.debug('💾 [UTIL] getBookmarkStatus function completed');
  }
};

/**
 * Delete a chat and all its messages
 */
export const deleteChat = async (chatId: string): Promise<void> => {
  logger.debug('💾 [UTIL] deleteChat function called');
  performanceMonitor.startTimer('deleteChat');
  
  try {
    const database = await initNormalizedDB();
    const transaction = database.transaction([STORES.CHATS, STORES.MESSAGES, STORES.BOOKMARKS], 'readwrite');
    
    // Delete chat metadata
    const chatStore = transaction.objectStore(STORES.CHATS);
    await new Promise<void>((resolve, reject) => {
      const request = chatStore.delete(chatId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    // Delete all messages for this chat
    const messageStore = transaction.objectStore(STORES.MESSAGES);
    const messageIndex = messageStore.index('chatId');
    await new Promise<void>((resolve, reject) => {
      const request = messageIndex.getAll(chatId);
      request.onsuccess = () => {
        const deletePromises = request.result.map((message: MessageRecord) => 
          new Promise<void>((resolve, reject) => {
            const deleteRequest = messageStore.delete(message.id);
            deleteRequest.onsuccess = () => resolve();
            deleteRequest.onerror = () => reject(deleteRequest.error);
          })
        );
        Promise.all(deletePromises).then(() => resolve()).catch(reject);
      };
      request.onerror = () => reject(request.error);
    });
    
    // Delete all bookmarks for this chat
    const bookmarkStore = transaction.objectStore(STORES.BOOKMARKS);
    const bookmarkIndex = bookmarkStore.index('chatId');
    await new Promise<void>((resolve, reject) => {
      const request = bookmarkIndex.getAll(chatId);
      request.onsuccess = () => {
        const deletePromises = request.result.map((bookmark: BookmarkRecord) => 
          new Promise<void>((resolve, reject) => {
            const deleteRequest = bookmarkStore.delete(bookmark.id);
            deleteRequest.onsuccess = () => resolve();
            deleteRequest.onerror = () => reject(deleteRequest.error);
          })
        );
        Promise.all(deletePromises).then(() => resolve()).catch(reject);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    logger.error('💾 [DB] Failed to delete chat:', error);
    throw error;
  } finally {
    performanceMonitor.endTimer('deleteChat');
    logger.debug('💾 [UTIL] deleteChat function completed');
  }
};

/**
 * Get message and chat data for bookmarking
 */
export const getMessageAndChatForBookmark = async (
  messageId: string,
  chatId: string
): Promise<{
  messageData: {
    sender: string;
    content: string;
    date: string;
    time: string;
    isSystemMessage: boolean;
  };
  chatName: string;
} | null> => {
  logger.debug('💾 [UTIL] getMessageAndChatForBookmark function called');
  try {
    const database = await initNormalizedDB();
    const transaction = database.transaction([STORES.MESSAGES, STORES.CHATS], 'readonly');
    const messageStore = transaction.objectStore(STORES.MESSAGES);
    const chatStore = transaction.objectStore(STORES.CHATS);
    
    const [messageRecord, chatRecord] = await Promise.all([
      new Promise<MessageRecord>((resolve, reject) => {
        const request = messageStore.get(messageId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
      new Promise<ChatRecord>((resolve, reject) => {
        const request = chatStore.get(chatId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
    ]);
    
    if (!messageRecord || !chatRecord) {
      return null;
    }
    
    return {
      messageData: {
        sender: messageRecord.sender,
        content: messageRecord.content,
        date: messageRecord.date,
        time: messageRecord.time,
        isSystemMessage: messageRecord.isSystemMessage
      },
      chatName: chatRecord.name
    };
  } catch (error) {
    logger.error('💾 [DB] Failed to get message and chat data:', error);
    return null;
  } finally {
    logger.debug('💾 [UTIL] getMessageAndChatForBookmark function completed');
  }
};

/**
 * Save a bookmark (backward compatibility wrapper)
 */
export const saveBookmarkLegacy = async (messageId: string, chatId: string): Promise<void> => {
  const data = await getMessageAndChatForBookmark(messageId, chatId);
  if (!data) {
    throw new Error('Message or chat not found');
  }
  
  return saveBookmark(messageId, chatId, data.messageData, data.chatName);
};

// Export types for use in other files
export type { ChatRecord, MessageRecord, BookmarkRecord, MetadataRecord };

logger.debug('💾 [UTIL] normalizedDb module loaded');
