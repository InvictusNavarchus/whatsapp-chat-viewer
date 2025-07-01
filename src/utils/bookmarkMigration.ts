/**
 * Migration utilities for upgrading bookmark data structure
 */

import { performanceMonitor } from './performance';

const DB_NAME = 'whatsapp-viewer-v2';

/**
 * Migrate existing bookmarks from normalized to denormalized format
 * This runs automatically during database upgrade
 */
export const migrateBookmarksToV2 = async (): Promise<void> => {
  performanceMonitor.startTimer('migrateBookmarksToV2');
  
  try {
    // Open a temporary connection to the old database to check for existing bookmarks
    const oldDb = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = () => {
        // If upgrade is needed, there's no old data to migrate
        resolve(request.result);
      };
    });

    if (!oldDb.objectStoreNames.contains('bookmarks')) {
      console.log('No existing bookmarks to migrate');
      oldDb.close();
      return;
    }

    // Get old bookmark data
    const transaction = oldDb.transaction(['bookmarks', 'messages', 'chats'], 'readonly');
    const bookmarkStore = transaction.objectStore('bookmarks');
    const messageStore = transaction.objectStore('messages');
    const chatStore = transaction.objectStore('chats');

    const oldBookmarks = await new Promise<any[]>((resolve, reject) => {
      const request = bookmarkStore.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    console.log(`Found ${oldBookmarks.length} bookmarks to migrate`);

    // Convert each bookmark to new format
    const migratedBookmarks = await Promise.all(
      oldBookmarks.map(async (bookmark) => {
        try {
          const [messageRecord, chatRecord] = await Promise.all([
            new Promise<any>((resolve, reject) => {
              const request = messageStore.get(bookmark.messageId);
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error);
            }),
            new Promise<any>((resolve, reject) => {
              const request = chatStore.get(bookmark.chatId);
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error);
            })
          ]);

          if (!messageRecord || !chatRecord) {
            console.warn(`Skipping bookmark ${bookmark.id} - missing message or chat data`);
            return null;
          }

          return {
            id: bookmark.messageId,
            chatId: bookmark.chatId,
            createdAt: bookmark.createdAt,
            sender: messageRecord.sender,
            content: messageRecord.content,
            date: messageRecord.date,
            time: messageRecord.time,
            chatName: chatRecord.name,
            isSystemMessage: messageRecord.isSystemMessage
          };
        } catch (error) {
          console.error(`Error migrating bookmark ${bookmark.id}:`, error);
          return null;
        }
      })
    );

    oldDb.close();

    // Filter out failed migrations
    const validBookmarks = migratedBookmarks.filter(bookmark => bookmark !== null);
    console.log(`Successfully migrated ${validBookmarks.length} bookmarks`);

    // Store migrated bookmarks in the new format
    if (validBookmarks.length > 0) {
      const newDb = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 2);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });

      const newTransaction = newDb.transaction(['bookmarks'], 'readwrite');
      const newBookmarkStore = newTransaction.objectStore('bookmarks');

      await Promise.all(
        validBookmarks.map(bookmark => 
          new Promise<void>((resolve, reject) => {
            const request = newBookmarkStore.put(bookmark);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          })
        )
      );

      newDb.close();
    }

  } catch (error) {
    console.error('Error during bookmark migration:', error);
    // Don't throw - allow the app to continue with empty bookmarks
  } finally {
    performanceMonitor.endTimer('migrateBookmarksToV2');
  }
};

export default { migrateBookmarksToV2 };
