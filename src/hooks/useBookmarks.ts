import { useState, useEffect, useCallback, useRef } from 'react';
import { BookmarkedMessage } from '@/types/chat';
import { 
  loadBookmarks, 
  saveBookmarkLegacy, 
  removeBookmark, 
  isMessageBookmarked,
  getBookmarkStatus
} from '@/utils/normalizedDb';
import { 
  loadBookmarks as loadLegacyBookmarks,
  clearLegacyBookmarks 
} from '@/utils/localStorage';
import { performanceMonitor } from '@/utils/performance';
import log from 'loglevel';

const logger = log.getLogger('useBookmarks');
logger.setLevel('debug');

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
    logger.debug('🔄 [HOOK] useEffect: initializeBookmarks called');
    const initializeBookmarks = async () => {
      logger.debug('🔄 [HOOK] initializeBookmarks: start');
      try {
        setIsLoading(true);
        setError(null);
        logger.debug('🔄 [HOOK] Loading bookmarks from IndexedDB');
        const indexedBookmarks = await loadBookmarks();
        logger.debug('🔄 [HOOK] Loaded bookmarks:', indexedBookmarks.length);
        if (indexedBookmarks.length === 0) {
          logger.debug('🔄 [HOOK] No bookmarks in IndexedDB, checking migration flag');
          const MIGRATION_FLAG = 'bookmarks_migration_completed';
          const migrationCompleted = localStorage.getItem(MIGRATION_FLAG) === 'true';
          if (!migrationCompleted) {
            logger.info('🕰️ [HOOK] Migrating legacy bookmarks from localStorage');
            const legacyBookmarks = loadLegacyBookmarks();
            logger.debug('🔄 [HOOK] Legacy bookmarks found:', legacyBookmarks.length);
            if (legacyBookmarks.length > 0) {
              for (const bookmark of legacyBookmarks) {
                logger.debug('🔄 [HOOK] Migrating bookmark:', bookmark.id);
                await saveBookmarkLegacy(bookmark.id, bookmark.chatId);
              }
              logger.info('✅ [HOOK] Migration complete, reloading bookmarks');
              const migratedBookmarks = await loadBookmarks();
              setBookmarks(migratedBookmarks);
              clearLegacyBookmarks();
              localStorage.setItem(MIGRATION_FLAG, 'true');
            } else {
              logger.info('📭 [HOOK] No legacy bookmarks found, marking migration complete');
              localStorage.setItem(MIGRATION_FLAG, 'true');
              setBookmarks([]);
            }
          } else {
            logger.debug('🔄 [HOOK] Migration already completed, no bookmarks exist');
            setBookmarks([]);
          }
        } else {
          logger.debug('🔄 [HOOK] Bookmarks found in IndexedDB, setting state');
          setBookmarks(indexedBookmarks);
        }
      } catch (err) {
        logger.error('❌ [HOOK] Failed to initialize bookmarks:', err);
        setError('Failed to load bookmarks');
        const legacyBookmarks = loadLegacyBookmarks();
        logger.debug('🔄 [HOOK] Fallback to legacy bookmarks:', legacyBookmarks.length);
        setBookmarks(legacyBookmarks);
      } finally {
        setIsLoading(false);
        logger.debug('🔄 [HOOK] initializeBookmarks: end');
      }
    };
    initializeBookmarks();
    logger.debug('🔄 [HOOK] useEffect: initializeBookmarks scheduled');
  }, []);
  
  /**
   * Add a bookmark with optimistic update
   */
  const addBookmark = useCallback(async (bookmark: BookmarkedMessage) => {
    logger.info('⭐ [HOOK] addBookmark called for message:', bookmark.id);
    const messageId = bookmark.id;
    if (pendingOperations.current.has(messageId)) {
      logger.debug('⏳ [HOOK] addBookmark: operation already pending for', messageId);
      return;
    }
    performanceMonitor.startTimer('addBookmark');
    pendingOperations.current.add(messageId);
    try {
      setBookmarks(prev => {
        const exists = prev.some(b => b.id === messageId);
        if (exists) {
          logger.debug('⭐ [HOOK] addBookmark: already exists in state', messageId);
          return prev;
        }
        logger.debug('⭐ [HOOK] addBookmark: optimistic update for', messageId);
        return [bookmark, ...prev];
      });
      logger.debug('⭐ [HOOK] addBookmark: saving to IndexedDB', messageId);
      await saveBookmarkLegacy(bookmark.id, bookmark.chatId);
      logger.info('⭐ [HOOK] addBookmark: saved to IndexedDB', messageId);
    } catch (err) {
      logger.error('❌ [HOOK] Failed to add bookmark:', err);
      setError('Failed to add bookmark');
      setBookmarks(prev => prev.filter(b => b.id !== messageId));
    } finally {
      performanceMonitor.endTimer('addBookmark');
      pendingOperations.current.delete(messageId);
      logger.debug('⭐ [HOOK] addBookmark: end for', messageId);
    }
  }, []);
  
  /**
   * Remove a bookmark with optimistic update
   */
  const deleteBookmark = useCallback(async (messageId: string) => {
    logger.info('🗑️ [HOOK] deleteBookmark called for message:', messageId);
    if (pendingOperations.current.has(messageId)) {
      logger.debug('⏳ [HOOK] deleteBookmark: operation already pending for', messageId);
      return;
    }
    pendingOperations.current.add(messageId);
    const removedBookmark = bookmarks.find(b => b.id === messageId);
    try {
      setBookmarks(prev => prev.filter(b => b.id !== messageId));
      logger.debug('🗑️ [HOOK] deleteBookmark: removed from state', messageId);
      await removeBookmark(messageId);
      logger.info('🗑️ [HOOK] deleteBookmark: removed from IndexedDB', messageId);
    } catch (err) {
      logger.error('❌ [HOOK] Failed to remove bookmark:', err);
      setError('Failed to remove bookmark');
      if (removedBookmark) {
        setBookmarks(prev => [removedBookmark, ...prev]);
        logger.debug('🗑️ [HOOK] deleteBookmark: rollback state for', messageId);
      }
    } finally {
      pendingOperations.current.delete(messageId);
      logger.debug('🗑️ [HOOK] deleteBookmark: end for', messageId);
    }
  }, [bookmarks]);
  
  /**
   * Toggle bookmark status for a message
   */
  const toggleBookmark = useCallback(async (message: BookmarkedMessage) => {
    logger.info('🔁 [HOOK] toggleBookmark called for message:', message.id);
    const isBookmarked = bookmarks.some(b => b.id === message.id);
    logger.debug('🔁 [HOOK] toggleBookmark: isBookmarked =', isBookmarked);
    if (isBookmarked) {
      await deleteBookmark(message.id);
      logger.info('🔁 [HOOK] toggleBookmark: removed bookmark', message.id);
    } else {
      await addBookmark(message);
      logger.info('🔁 [HOOK] toggleBookmark: added bookmark', message.id);
    }
  }, [bookmarks, addBookmark, deleteBookmark]);
  
  /**
   * Check if a message is bookmarked (fast lookup)
   */
  const isBookmarked = useCallback((messageId: string): boolean => {
    const result = bookmarks.some(b => b.id === messageId);
    logger.debug('🔍 [HOOK] isBookmarked called for', messageId, 'result:', result);
    return result;
  }, [bookmarks]);
  
  /**
   * Get bookmarks for a specific chat
   */
  const getBookmarksForChat = useCallback((chatId: string): BookmarkedMessage[] => {
    const result = bookmarks.filter(b => b.chatId === chatId);
    logger.debug('📚 [HOOK] getBookmarksForChat called for', chatId, 'result:', result.length);
    return result;
  }, [bookmarks]);
  
  /**
   * Refresh bookmarks from storage (useful after external changes)
   */
  const refreshBookmarks = useCallback(async () => {
    logger.info('🔄 [HOOK] refreshBookmarks called');
    try {
      setIsLoading(true);
      logger.debug('🔄 [HOOK] refreshBookmarks: loading from IndexedDB');
      const freshBookmarks = await loadBookmarks();
      setBookmarks(freshBookmarks);
      setError(null);
      logger.info('🔄 [HOOK] refreshBookmarks: loaded', freshBookmarks.length, 'bookmarks');
    } catch (err) {
      logger.error('❌ [HOOK] Failed to refresh bookmarks:', err);
      setError('Failed to refresh bookmarks');
    } finally {
      setIsLoading(false);
      logger.debug('🔄 [HOOK] refreshBookmarks: end');
    }
  }, []);
  
  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    logger.debug('🧹 [HOOK] clearError called');
    setError(null);
  }, []);

  /**
   * Get performance metrics (for debugging)
   */
  const getPerformanceMetrics = useCallback(() => {
    return performanceMonitor.getMetrics();
  }, []);
  
  /**
   * Log performance summary (for debugging)
   */
  const logPerformanceSummary = useCallback(() => {
    performanceMonitor.logSummary();
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
    getPerformanceMetrics,
    logPerformanceSummary
  };
};
