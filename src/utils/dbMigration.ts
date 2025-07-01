import { Chat, BookmarkedMessage } from '@/types/chat';
import { loadChatsFromIndexedDB } from './indexedDb';
import { saveChat, loadAllChatMetadata, saveBookmark } from './normalizedDb';
import { loadBookmarks as loadLegacyBookmarks } from './localStorage';
import { performanceMonitor } from './performance';

/**
 * Check if the old IndexedDB structure exists
 * Returns true if migration is needed
 */
export const needsMigrationFromOldDb = async (): Promise<boolean> => {
  try {
    // Check if old database exists
    const oldChats = await loadChatsFromIndexedDB();
    const newChats = await loadAllChatMetadata();
    
    // If old DB has data and new DB is empty, migration is needed
    return oldChats.length > 0 && newChats.length === 0;
  } catch (error) {
    console.error('Failed to check migration status:', error);
    return false;
  }
};

/**
 * Migrate chat data from old IndexedDB structure to normalized structure
 */
export const migrateChatData = async (): Promise<{ success: boolean; migratedChats: number; migratedMessages: number }> => {
  performanceMonitor.startTimer('migrateChatData');
  
  try {
    console.log('Starting migration from old IndexedDB structure...');
    
    // Load all chats from old structure
    const oldChats = await loadChatsFromIndexedDB();
    
    if (oldChats.length === 0) {
      console.log('No chats found in old structure, skipping migration');
      return { success: true, migratedChats: 0, migratedMessages: 0 };
    }
    
    let totalMessages = 0;
    
    // Migrate each chat
    for (const chat of oldChats) {
      console.log(`Migrating chat: ${chat.name} (${chat.messages.length} messages)`);
      
      await saveChat(chat);
      totalMessages += chat.messages.length;
    }
    
    console.log(`Successfully migrated ${oldChats.length} chats with ${totalMessages} messages`);
    
    return {
      success: true,
      migratedChats: oldChats.length,
      migratedMessages: totalMessages
    };
  } catch (error) {
    console.error('Failed to migrate chat data:', error);
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
    console.log('Starting bookmark migration from localStorage...');
    
    // Load bookmarks from localStorage
    const legacyBookmarks = loadLegacyBookmarks();
    
    if (legacyBookmarks.length === 0) {
      console.log('No bookmarks found in localStorage, skipping migration');
      return { success: true, migratedBookmarks: 0 };
    }
    
    // Migrate each bookmark
    for (const bookmark of legacyBookmarks) {
      await saveBookmark(bookmark.id, bookmark.chatId);
    }
    
    console.log(`Successfully migrated ${legacyBookmarks.length} bookmarks`);
    
    return {
      success: true,
      migratedBookmarks: legacyBookmarks.length
    };
  } catch (error) {
    console.error('Failed to migrate bookmark data:', error);
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
    console.log('Starting full data migration to normalized structure...');
    
    // Run both migrations in parallel
    const [chatMigration, bookmarkMigration] = await Promise.all([
      migrateChatData(),
      migrateBookmarkData()
    ]);
    
    const success = chatMigration.success && bookmarkMigration.success;
    
    if (success) {
      console.log('Full migration completed successfully!');
      performanceMonitor.logSummary();
    } else {
      console.error('Migration completed with errors');
    }
    
    return {
      success,
      chatMigration,
      bookmarkMigration
    };
  } catch (error) {
    console.error('Failed to perform full migration:', error);
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
        console.log('Old database cleaned up successfully');
        resolve();
      };
      deleteRequest.onerror = () => {
        console.error('Failed to cleanup old database:', deleteRequest.error);
        reject(deleteRequest.error);
      };
    });
  } catch (error) {
    console.error('Failed to cleanup old database:', error);
    // Don't throw - cleanup failure shouldn't break the app
  }
};
