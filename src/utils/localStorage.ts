import { BookmarkedMessage } from '@/types/chat';

const STORAGE_KEYS = {
  BOOKMARKS: 'whatsapp-viewer-bookmarks',
  ACTIVE_CHAT: 'whatsapp-viewer-active-chat'
};

export const saveBookmarks = (bookmarks: BookmarkedMessage[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
  } catch (error) {
    console.error('Failed to save bookmarks:', error);
  }
};

export const loadBookmarks = (): BookmarkedMessage[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.BOOKMARKS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load bookmarks:', error);
    return [];
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