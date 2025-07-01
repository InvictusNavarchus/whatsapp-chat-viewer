import { BookmarkedMessage } from '@/types/chat';

const STORAGE_KEYS = {
  BOOKMARKS: 'whatsapp-viewer-bookmarks',
  ACTIVE_CHAT: 'whatsapp-viewer-active-chat'
};

/**
 * @deprecated Use bookmarkStorage.ts for new bookmark operations
 * Save bookmarks to localStorage (legacy function for migration only)
 */
export const saveBookmarks = (bookmarks: BookmarkedMessage[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
  } catch (error) {
    console.error('Failed to save bookmarks:', error);
  }
};

/**
 * @deprecated Use bookmarkStorage.ts for new bookmark operations
 * Load bookmarks from localStorage (legacy function for migration only)
 */
export const loadBookmarks = (): BookmarkedMessage[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.BOOKMARKS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load bookmarks:', error);
    return [];
  }
};

/**
 * Clear legacy bookmark data from localStorage
 * Used after successful migration to IndexedDB
 */
export const clearLegacyBookmarks = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.BOOKMARKS);
  } catch (error) {
    console.error('Failed to clear legacy bookmarks:', error);
  }
};

export const saveActiveChat = (chatId: string | null): void => {
  try {
    if (chatId) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_CHAT, chatId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_CHAT);
    }
  } catch (error) {
    console.error('Failed to save active chat:', error);
  }
};

export const loadActiveChat = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_CHAT);
  } catch (error) {
    console.error('Failed to load active chat:', error);
    return null;
  }
};