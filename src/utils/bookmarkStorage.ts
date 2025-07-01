import { BookmarkedMessage } from '@/types/chat';
import { performanceMonitor } from './performance';
import log from 'loglevel';

const logger = log.getLogger('bookmarkStorage');
logger.setLevel('debug');

const DB_NAME = 'WhatsAppViewerBookmarks';
const DB_VERSION = 1;
const STORE_NAME = 'bookmarks';

let db: IDBDatabase | null = null;

logger.debug('🔖 [UTIL] bookmarkStorage module loaded');

/**
 * Check if the database connection is valid and active
 */
const isDatabaseValid = (): boolean => {
  if (!db) return false;
  
  // Check if the database is closed
  try {
    // Try to access the database - this will throw if closed
    void db.objectStoreNames;
    return true;
  } catch (error) {
    // Database is closed or invalid
    db = null;
    return false;
  }
};

/**
 * Initialize the IndexedDB database for bookmarks
 * Creates the database with proper indexing for efficient lookups
 */
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    // Return existing valid connection
    if (isDatabaseValid()) {
      resolve(db!);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      db = null;
      reject(request.error);
    };
    
    request.onsuccess = () => {
      db = request.result;
      
      // Set up connection loss handlers
      db.onclose = () => {
        logger.warn('🔌 [BOOKMARK STORAGE] IndexedDB connection closed unexpectedly');
        db = null;
      };
      
      db.onerror = (event) => {
        logger.error('❌ [BOOKMARK STORAGE] IndexedDB connection error:', event);
        db = null;
      };
      
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        
        // Create indexes for efficient querying
        store.createIndex('chatId', 'chatId', { unique: false });
        store.createIndex('sender', 'sender', { unique: false });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('chatIdAndMessageId', ['chatId', 'id'], { unique: true });
      }
    };
  });
};

/**
 * Save a bookmark to IndexedDB
 * Uses upsert operation for efficiency
 */
export const saveBookmark = async (bookmark: BookmarkedMessage): Promise<void> => {
  logger.debug('🔖 [BOOKMARK STORAGE] Saving bookmark');
  performanceMonitor.startTimer('saveBookmark');
  
  try {
    const database = await initDB();
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(bookmark);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    logger.error('❌ [BOOKMARK STORAGE] Failed to save bookmark:', error);
    throw error;
  } finally {
    performanceMonitor.endTimer('saveBookmark');
    logger.debug('🔖 [BOOKMARK STORAGE] Bookmark saved');
  }
};

/**
 * Remove a bookmark from IndexedDB by message ID
 */
export const removeBookmark = async (messageId: string): Promise<void> => {
  logger.debug('🔖 [BOOKMARK STORAGE] Removing bookmark');
  try {
    const database = await initDB();
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(messageId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    logger.error('❌ [BOOKMARK STORAGE] Failed to remove bookmark:', error);
    throw error;
  }
};

/**
 * Load all bookmarks from IndexedDB
 * Returns bookmarks sorted by date/time (newest first)
 */
export const loadBookmarks = async (): Promise<BookmarkedMessage[]> => {
  logger.debug('🔖 [BOOKMARK STORAGE] Loading bookmarks');
  performanceMonitor.startTimer('loadBookmarks');
  
  try {
    const database = await initDB();
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise<BookmarkedMessage[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        // Sort by date and time (newest first)
        const bookmarks = request.result.sort((a, b) => {
          const dateA = new Date(`${a.date} ${a.time}`);
          const dateB = new Date(`${b.date} ${b.time}`);
          return dateB.getTime() - dateA.getTime();
        });
        resolve(bookmarks);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    logger.error('❌ [BOOKMARK STORAGE] Failed to load bookmarks:', error);
    return [];
  } finally {
    performanceMonitor.endTimer('loadBookmarks');
    logger.debug('🔖 [BOOKMARK STORAGE] Bookmarks loaded');
  }
};

/**
 * Check if a message is bookmarked using indexed lookup
 * Much faster than array.find() for large datasets
 */
export const isMessageBookmarked = async (messageId: string): Promise<boolean> => {
  logger.debug('🔖 [BOOKMARK STORAGE] Checking bookmark status');
  try {
    const database = await initDB();
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise<boolean>((resolve, reject) => {
      const request = store.get(messageId);
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    logger.error('❌ [BOOKMARK STORAGE] Failed to check bookmark status:', error);
    return false;
  }
};

/**
 * Get bookmarks for a specific chat using indexed lookup
 */
export const getBookmarksByChat = async (chatId: string): Promise<BookmarkedMessage[]> => {
  logger.debug('🔖 [BOOKMARK STORAGE] Getting bookmarks by chat');
  try {
    const database = await initDB();
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('chatId');
    
    return new Promise<BookmarkedMessage[]>((resolve, reject) => {
      const request = index.getAll(chatId);
      request.onsuccess = () => {
        const bookmarks = request.result.sort((a, b) => {
          const dateA = new Date(`${a.date} ${a.time}`);
          const dateB = new Date(`${b.date} ${b.time}`);
          return dateB.getTime() - dateA.getTime();
        });
        resolve(bookmarks);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    logger.error('❌ [BOOKMARK STORAGE] Failed to get bookmarks by chat:', error);
    return [];
  }
};

/**
 * Clear all bookmarks (for cleanup/reset)
 */
export const clearAllBookmarks = async (): Promise<void> => {
  logger.debug('🔖 [BOOKMARK STORAGE] Clearing all bookmarks');
  try {
    const database = await initDB();
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    logger.error('❌ [BOOKMARK STORAGE] Failed to clear bookmarks:', error);
    throw error;
  }
};

/**
 * Batch save multiple bookmarks efficiently
 * Useful for migrations or bulk operations
 */
export const saveBookmarksBatch = async (bookmarks: BookmarkedMessage[]): Promise<void> => {
  logger.debug('🔖 [BOOKMARK STORAGE] Saving bookmarks batch');
  try {
    const database = await initDB();
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // Use transaction oncomplete for better performance
    await new Promise<void>((resolve, reject) => {
      // Queue all put operations
      bookmarks.forEach(bookmark => {
        store.put(bookmark);
      });
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    logger.error('❌ [BOOKMARK STORAGE] Failed to save bookmarks batch:', error);
    throw error;
  }
};
