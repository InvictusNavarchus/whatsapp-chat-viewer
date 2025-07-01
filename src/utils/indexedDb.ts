import { Chat } from '@/types/chat';

const DB_NAME = 'whatsapp-viewer-db';
const DB_VERSION = 1;
const CHAT_STORE = 'chats';

/**
 * Opens the IndexedDB database and creates object stores if needed
 * @returns Promise that resolves to the database instance
 */
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create chats store if it doesn't exist
      if (!db.objectStoreNames.contains(CHAT_STORE)) {
        const chatStore = db.createObjectStore(CHAT_STORE, { keyPath: 'id' });
        chatStore.createIndex('createdAt', 'createdAt');
        chatStore.createIndex('name', 'name');
      }
    };
  });
};

/**
 * Saves all chats to IndexedDB
 * @param chats - Array of chat objects to save
 */
export const saveChatsToIndexedDB = async (chats: Chat[]): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([CHAT_STORE], 'readwrite');
    const store = transaction.objectStore(CHAT_STORE);

    // Clear existing chats and add new ones
    await new Promise<void>((resolve, reject) => {
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error);
    });

    // Add all chats
    for (const chat of chats) {
      await new Promise<void>((resolve, reject) => {
        const addRequest = store.add(chat);
        addRequest.onsuccess = () => resolve();
        addRequest.onerror = () => reject(addRequest.error);
      });
    }

    db.close();
  } catch (error) {
    console.error('Failed to save chats to IndexedDB:', error);
    throw error;
  }
};

/**
 * Loads all chats from IndexedDB
 * @returns Promise that resolves to array of chat objects
 */
export const loadChatsFromIndexedDB = async (): Promise<Chat[]> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([CHAT_STORE], 'readonly');
    const store = transaction.objectStore(CHAT_STORE);

    const chats = await new Promise<Chat[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const results = request.result.map((chat: Chat & { createdAt: string | Date }) => ({
          ...chat,
          createdAt: new Date(chat.createdAt)
        }));
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });

    db.close();
    return chats;
  } catch (error) {
    console.error('Failed to load chats from IndexedDB:', error);
    return [];
  }
};

/**
 * Saves a single chat to IndexedDB
 * @param chat - Chat object to save
 */
export const saveChatToIndexedDB = async (chat: Chat): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([CHAT_STORE], 'readwrite');
    const store = transaction.objectStore(CHAT_STORE);

    await new Promise<void>((resolve, reject) => {
      const request = store.put(chat);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();
  } catch (error) {
    console.error('Failed to save chat to IndexedDB:', error);
    throw error;
  }
};

/**
 * Deletes a chat from IndexedDB by ID
 * @param chatId - ID of the chat to delete
 */
export const deleteChatFromIndexedDB = async (chatId: string): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([CHAT_STORE], 'readwrite');
    const store = transaction.objectStore(CHAT_STORE);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(chatId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();
  } catch (error) {
    console.error('Failed to delete chat from IndexedDB:', error);
    throw error;
  }
};

/**
 * Gets a single chat from IndexedDB by ID
 * @param chatId - ID of the chat to retrieve
 * @returns Promise that resolves to the chat object or null if not found
 */
export const getChatFromIndexedDB = async (chatId: string): Promise<Chat | null> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([CHAT_STORE], 'readonly');
    const store = transaction.objectStore(CHAT_STORE);

    const chat = await new Promise<Chat | null>((resolve, reject) => {
      const request = store.get(chatId);
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          resolve({
            ...result,
            createdAt: new Date(result.createdAt)
          });
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });

    db.close();
    return chat;
  } catch (error) {
    console.error('Failed to get chat from IndexedDB:', error);
    return null;
  }
};

/**
 * Load chats from IndexedDB in batches for memory optimization
 * @param offset - Starting index
 * @param limit - Number of chats to load
 */
export const loadChatsBatch = async (offset: number, limit: number): Promise<Chat[]> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([CHAT_STORE], 'readonly');
    const store = transaction.objectStore(CHAT_STORE);

    const chats = await new Promise<Chat[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const allResults = request.result.map((chat: Chat & { createdAt: string | Date }) => ({
          ...chat,
          createdAt: new Date(chat.createdAt)
        }));
        // Return the requested batch
        const batch = allResults.slice(offset, offset + limit);
        resolve(batch);
      };
      request.onerror = () => reject(request.error);
    });

    db.close();
    return chats;
  } catch (error) {
    console.error('Failed to load chats batch from IndexedDB:', error);
    return [];
  }
};
