import { Chat } from '@/types/chat';
import { saveChatsToIndexedDB } from './indexedDb';

/**
 * Migrates existing chat data from localStorage to IndexedDB
 * This function should be called once to migrate legacy data
 * @returns Promise that resolves to true if migration was successful or not needed
 */
export const migrateChatsFromLocalStorage = async (): Promise<boolean> => {
  try {
    const legacyChatsKey = 'whatsapp-viewer-chats';
    const legacyData = localStorage.getItem(legacyChatsKey);
    
    if (!legacyData) {
      // No legacy data to migrate
      return true;
    }

    const chats = JSON.parse(legacyData);
    
    // Convert createdAt back to Date objects
    const migratedChats: Chat[] = chats.map((chat: Chat & { createdAt: string | Date }) => ({
      ...chat,
      createdAt: new Date(chat.createdAt)
    }));

    // Save to IndexedDB
    await saveChatsToIndexedDB(migratedChats);
    
    // Remove from localStorage after successful migration
    localStorage.removeItem(legacyChatsKey);
    
    console.log(`Successfully migrated ${migratedChats.length} chats from localStorage to IndexedDB`);
    return true;
  } catch (error) {
    console.error('Failed to migrate chats from localStorage:', error);
    return false;
  }
};

/**
 * Checks if there's legacy chat data in localStorage that needs migration
 * @returns true if legacy data exists
 */
export const hasLegacyChatData = (): boolean => {
  const legacyChatsKey = 'whatsapp-viewer-chats';
  return localStorage.getItem(legacyChatsKey) !== null;
};
