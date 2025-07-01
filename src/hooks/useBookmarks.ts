import { useState, useEffect, useCallback, useRef } from 'react';
import { BookmarkedMessage } from '@/types/chat';
import { 
  loadBookmarks, 
  saveBookmark, 
  removeBookmark, 
  isMessageBookmarked,
  saveBookmarksBatch
} from '@/utils/bookmarkStorage';
import { 
  loadBookmarks as loadLegacyBookmarks,
  clearLegacyBookmarks 
} from '@/utils/localStorage';
import { performanceMonitor } from '@/utils/performance';

/**
 * Custom hook for managing bookmarks with IndexedDB storage and efficient state management
 * Provides debounced operations and optimistic updates for better UX
 */
export const useBookmarks = () => {
  const [bookmarks, setBookmarks] = useState<BookmarkedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Keep track of pending operations to avoid race conditions
  const pendingOperations = useRef(new Set<string>());
  
  /**
   * Load bookmarks from IndexedDB on hook initialization
   * Also handles migration from localStorage if needed
   */
  useEffect(() => {
    const initializeBookmarks = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Load from IndexedDB
        const indexedBookmarks = await loadBookmarks();
        
        // If no bookmarks in IndexedDB, check for legacy data
        if (indexedBookmarks.length === 0) {
          const legacyBookmarks = loadLegacyBookmarks();
          if (legacyBookmarks.length > 0) {
            // Migrate legacy bookmarks to IndexedDB
            await saveBookmarksBatch(legacyBookmarks);
            setBookmarks(legacyBookmarks);
            
            // Clear legacy data after successful migration
            clearLegacyBookmarks();
            
            console.log('Migrated', legacyBookmarks.length, 'bookmarks from localStorage to IndexedDB');
          } else {
            setBookmarks([]);
          }
        } else {
          setBookmarks(indexedBookmarks);
        }
      } catch (err) {
        console.error('Failed to initialize bookmarks:', err);
        setError('Failed to load bookmarks');
        // Fallback to localStorage
        const legacyBookmarks = loadLegacyBookmarks();
        setBookmarks(legacyBookmarks);
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeBookmarks();
  }, []);
  
  /**
   * Add a bookmark with optimistic update
   */
  const addBookmark = useCallback(async (bookmark: BookmarkedMessage) => {
    const messageId = bookmark.id;
    
    // Prevent duplicate operations
    if (pendingOperations.current.has(messageId)) {
      return;
    }
    
    performanceMonitor.startTimer('addBookmark');
    pendingOperations.current.add(messageId);
    
    try {
      // Optimistic update - update UI immediately
      setBookmarks(prev => {
        // Check if bookmark already exists
        const exists = prev.some(b => b.id === messageId);
        if (exists) return prev;
        
        // Add new bookmark at the beginning (newest first)
        return [bookmark, ...prev];
      });
      
      // Save to IndexedDB
      await saveBookmark(bookmark);
    } catch (err) {
      console.error('Failed to add bookmark:', err);
      setError('Failed to add bookmark');
      
      // Rollback optimistic update
      setBookmarks(prev => prev.filter(b => b.id !== messageId));
    } finally {
      performanceMonitor.endTimer('addBookmark');
      pendingOperations.current.delete(messageId);
    }
  }, []);
  
  /**
   * Remove a bookmark with optimistic update
   */
  const deleteBookmark = useCallback(async (messageId: string) => {
    // Prevent duplicate operations
    if (pendingOperations.current.has(messageId)) {
      return;
    }
    
    pendingOperations.current.add(messageId);
    
    // Store the removed bookmark for potential rollback
    const removedBookmark = bookmarks.find(b => b.id === messageId);
    
    try {
      // Optimistic update - update UI immediately
      setBookmarks(prev => prev.filter(b => b.id !== messageId));
      
      // Remove from IndexedDB
      await removeBookmark(messageId);
    } catch (err) {
      console.error('Failed to remove bookmark:', err);
      setError('Failed to remove bookmark');
      
      // Rollback optimistic update
      if (removedBookmark) {
        setBookmarks(prev => [removedBookmark, ...prev]);
      }
    } finally {
      pendingOperations.current.delete(messageId);
    }
  }, [bookmarks]);
  
  /**
   * Toggle bookmark status for a message
   */
  const toggleBookmark = useCallback(async (message: BookmarkedMessage) => {
    const isBookmarked = bookmarks.some(b => b.id === message.id);
    
    if (isBookmarked) {
      await deleteBookmark(message.id);
    } else {
      await addBookmark(message);
    }
  }, [bookmarks, addBookmark, deleteBookmark]);
  
  /**
   * Check if a message is bookmarked (fast lookup)
   */
  const isBookmarked = useCallback((messageId: string): boolean => {
    return bookmarks.some(b => b.id === messageId);
  }, [bookmarks]);
  
  /**
   * Get bookmarks for a specific chat
   */
  const getBookmarksForChat = useCallback((chatId: string): BookmarkedMessage[] => {
    return bookmarks.filter(b => b.chatId === chatId);
  }, [bookmarks]);
  
  /**
   * Refresh bookmarks from storage (useful after external changes)
   */
  const refreshBookmarks = useCallback(async () => {
    try {
      setIsLoading(true);
      const freshBookmarks = await loadBookmarks();
      setBookmarks(freshBookmarks);
      setError(null);
    } catch (err) {
      console.error('Failed to refresh bookmarks:', err);
      setError('Failed to refresh bookmarks');
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Get performance metrics (for debugging)
   */
  const getPerformanceMetrics = useCallback(() => {
    performanceMonitor.logSummary();
    return performanceMonitor.getMetrics();
  }, []);
  
  return {
    bookmarks,
    isLoading,
    error,
    addBookmark,
    deleteBookmark,
    toggleBookmark,
    isBookmarked,
    getBookmarksForChat,
    refreshBookmarks,
    clearError,
    getPerformanceMetrics
  };
};
