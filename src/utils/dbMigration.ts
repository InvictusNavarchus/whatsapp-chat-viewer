import { Chat, BookmarkedMessage } from '@/types/chat';
import { loadChatsFromIndexedDB, loadChatsBatch } from './indexedDb';
import { saveChat, loadAllChatMetadata, saveBookmarkLegacy } from './normalizedDb';
import { loadBookmarks as loadLegacyBookmarks } from './localStorage';
import { performanceMonitor } from './performance';
import log from 'loglevel';
const logger = log.getLogger('dbMigration');
logger.setLevel('debug');

/**
 * Check if any data exists in the old database
 */
const hasOldData = async (): Promise<boolean> => {
  try {
    // Try to open the old database and check if it has any data
    return new Promise<boolean>((resolve) => {
      const request = indexedDB.open('WhatsAppViewerDB', 1);
      
      request.onerror = () => resolve(false);
      request.onsuccess = () => {
        const db = request.result;
        try {
          if (!db.objectStoreNames.contains('chats')) {
            db.close();
            resolve(false);
            return;
          }
          
          const transaction = db.transaction(['chats'], 'readonly');
          const store = transaction.objectStore('chats');
          const countRequest = store.count();
          
          countRequest.onsuccess = () => {
            db.close();
            resolve(countRequest.result > 0);
          };
          
          countRequest.onerror = () => {
            db.close();
            resolve(false);
          };
        } catch (error) {
          db.close();
          resolve(false);
        }
      };
    });
  } catch (error) {
    return false;
  }
};

/**
 * Check if any data exists in the new database
 */
const hasNewData = async (): Promise<boolean> => {
  try {
    return new Promise<boolean>((resolve) => {
      const request = indexedDB.open('WhatsAppViewerNormalized', 1);
      
      request.onerror = () => resolve(false);
      request.onsuccess = () => {
        const db = request.result;
        try {
          if (!db.objectStoreNames.contains('chats')) {
            db.close();
            resolve(false);
            return;
          }
          
          const transaction = db.transaction(['chats'], 'readonly');
          const store = transaction.objectStore('chats');
          const countRequest = store.count();
          
          countRequest.onsuccess = () => {
            db.close();
            resolve(countRequest.result > 0);
          };
          
          countRequest.onerror = () => {
            db.close();
            resolve(false);
          };
        } catch (error) {
          db.close();
          resolve(false);
        }
      };
    });
  } catch (error) {
    return false;
  }
};

/**
 * Check if the old IndexedDB structure exists
 * Returns true if migration is needed
 */
export const needsMigrationFromOldDb = async (): Promise<boolean> => {
  try {
    // Check if old DB has data and new DB is empty
    const [hasOld, hasNew] = await Promise.all([hasOldData(), hasNewData()]);
    
    // If old DB has data and new DB is empty, migration is needed
    return hasOld && !hasNew;
  } catch (error) {
    logger.error('❌ [MIGRATION] Failed to check migration status:', error);
    return false;
  }
};

/**
 * Migrate chat data from old IndexedDB structure to normalized structure
 */
export const migrateChatData = async (): Promise<{ success: boolean; migratedChats: number; migratedMessages: number }> => {
  performanceMonitor.startTimer('migrateChatData');
  
  try {
    logger.info('🔄 [MIGRATION] Starting migration from old IndexedDB structure...');
    
    let migratedChats = 0;
    let totalMessages = 0;
    const BATCH_SIZE = 10; // Process chats in batches
    
    // Process chats in batches to optimize memory usage
    while (true) {
      const batch = await loadChatsBatch(migratedChats, BATCH_SIZE);
      if (batch.length === 0) break;
      
      for (const chat of batch) {
        logger.info(`🔄 [MIGRATION] Migrating chat: ${chat.name} (${chat.messages.length} messages)`);
        await saveChat(chat);
        totalMessages += chat.messages.length;
        migratedChats++;
      }
    }
    
    if (migratedChats === 0) {
      logger.info('📭 [MIGRATION] No chats found in old structure, skipping migration');
      return { success: true, migratedChats: 0, migratedMessages: 0 };
    }
    
    logger.info(`✅ [MIGRATION] Successfully migrated ${migratedChats} chats with ${totalMessages} messages`);
    
    return {
      success: true,
      migratedChats,
      migratedMessages: totalMessages
    };
  } catch (error) {
    logger.error('❌ [MIGRATION] Failed to migrate chat data:', error);
    return { success: false, migratedChats: 0, migratedMessages: 0 };
  } finally {
    performanceMonitor.endTimer('migrateChatData');
  }
};

/**
 * Migrate bookmark data from localStorage to normalized IndexedDB
 */
export const migrateBookmarkData = async (): Promise<{ success: boolean; migratedBookmarks: number }> => {
  performanceMonitor.startTimer('migrateBookmarkData');
  
  try {
    logger.info('🔄 [MIGRATION] Starting bookmark migration from localStorage...');
    
    // Load bookmarks from localStorage
    const legacyBookmarks = loadLegacyBookmarks();
    
    if (legacyBookmarks.length === 0) {
      logger.info('📭 [MIGRATION] No bookmarks found in localStorage, skipping migration');
      return { success: true, migratedBookmarks: 0 };
    }
    
    // Migrate each bookmark
    for (const bookmark of legacyBookmarks) {
      await saveBookmarkLegacy(bookmark.id, bookmark.chatId);
    }
    
    logger.info(`✅ [MIGRATION] Successfully migrated ${legacyBookmarks.length} bookmarks`);
    
    return {
      success: true,
      migratedBookmarks: legacyBookmarks.length
    };
  } catch (error) {
    logger.error('❌ [MIGRATION] Failed to migrate bookmark data:', error);
    return { success: false, migratedBookmarks: 0 };
  } finally {
    performanceMonitor.endTimer('migrateBookmarkData');
  }
};

/**
 * Perform complete migration from old structure to normalized structure
 */
export const performFullMigration = async (): Promise<{
  success: boolean;
  chatMigration: { success: boolean; migratedChats: number; migratedMessages: number };
  bookmarkMigration: { success: boolean; migratedBookmarks: number };
}> => {
  performanceMonitor.startTimer('performFullMigration');
  
  try {
    logger.info('🔄 [MIGRATION] Starting full data migration to normalized structure...');
    
    // Run both migrations in parallel
    const [chatMigration, bookmarkMigration] = await Promise.all([
      migrateChatData(),
      migrateBookmarkData()
    ]);
    
    const success = chatMigration.success && bookmarkMigration.success;
    
    if (success) {
      logger.info('🎉 [MIGRATION] Full migration completed successfully!');
      performanceMonitor.logSummary();
    } else {
      logger.error('⚠️ [MIGRATION] Migration completed with errors');
    }
    
    return {
      success,
      chatMigration,
      bookmarkMigration
    };
  } catch (error) {
    logger.error('❌ [MIGRATION] Failed to perform full migration:', error);
    return {
      success: false,
      chatMigration: { success: false, migratedChats: 0, migratedMessages: 0 },
      bookmarkMigration: { success: false, migratedBookmarks: 0 }
    };
  } finally {
    performanceMonitor.endTimer('performFullMigration');
  }
};

/**
 * Clean up old database after successful migration
 */
export const cleanupOldDatabase = async (): Promise<void> => {
  try {
    // Delete old IndexedDB
    const deleteRequest = indexedDB.deleteDatabase('whatsapp-viewer-db');
    
    await new Promise<void>((resolve, reject) => {
      deleteRequest.onsuccess = () => {
        logger.info('🧹 [MIGRATION] Old database cleaned up successfully');
        resolve();
      };
      deleteRequest.onerror = () => {
        logger.error('❌ [MIGRATION] Failed to cleanup old database:', deleteRequest.error);
        reject(deleteRequest.error);
      };
    });
  } catch (error) {
    logger.error('❌ [MIGRATION] Failed to cleanup old database:', error);
    // Don't throw - cleanup failure shouldn't break the app
  }
};
