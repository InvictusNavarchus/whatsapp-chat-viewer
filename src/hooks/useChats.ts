import { useState, useEffect, useCallback } from 'react';
import { Chat } from '@/types/chat';
import { 
  loadAllChatMetadata, 
  loadChat, 
  saveChat, 
  deleteChat,
  ChatRecord
} from '@/utils/normalizedDb';
import { needsMigrationFromOldDb, performFullMigration, cleanupOldDatabase } from '@/utils/dbMigration';
import { performanceMonitor } from '@/utils/performance';
import log from 'loglevel';

const logger = log.getLogger('useChats');
logger.setLevel('debug');

interface ChatListItem {
  id: string;
  name: string;
  createdAt: Date;
  lastMessageTime: string;
  messageCount: number;
  participantCount: number;
  participants: string[];
}

/**
 * Custom hook for managing chats with normalized IndexedDB storage
 * Provides efficient loading, caching, and lazy loading capabilities
 */
export const useChats = () => {
  const [chatList, setChatList] = useState<ChatListItem[]>([]);
  const [loadedChats, setLoadedChats] = useState<Map<string, Chat>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingChat, setIsLoadingChat] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<{
    isComplete: boolean;
    isRunning: boolean;
    error?: string;
  }>({ isComplete: false, isRunning: false });

  /**
   * Initialize chat data and handle migration if needed
   */
  useEffect(() => {
    logger.debug('🔄 [HOOK] useEffect: initializeChats called');
    let isMounted = true;
    const initializeChats = async () => {
      logger.debug('🔄 [HOOK] initializeChats: start');
      try {
        if (!isMounted) return;
        
        setIsLoading(true);
        setError(null);
        
        // Check if migration is needed
        logger.debug('🔄 [HOOK] Checking migration status');
        const needsMigration = await needsMigrationFromOldDb();
        logger.debug('🔄 [HOOK] needsMigration =', needsMigration);
        
        if (!isMounted) return;
        
        if (needsMigration) {
          logger.info('🕰️ [HOOK] Migration needed, starting migration process...');
          setMigrationStatus({ isComplete: false, isRunning: true });
          
          try {
            const migrationResult = await performFullMigration();
            
            if (!isMounted) return;
            
            if (migrationResult.success) {
              setMigrationStatus({ isComplete: true, isRunning: false });
              
              // Clean up old database in background
              cleanupOldDatabase().catch(e => logger.error('❌ [HOOK] Failed to cleanup old DB:', e));
              
              logger.info('✅ [HOOK] Migration completed:', migrationResult);
            } else {
              setMigrationStatus({ 
                isComplete: false, 
                isRunning: false, 
                error: 'Migration completed with errors' 
              });
              setError('Failed to migrate data from old format');
            }
          } catch (migrationError) {
            logger.error('❌ [HOOK] Migration failed:', migrationError);
            setMigrationStatus({ isComplete: true, isRunning: false, error: 'Migration failed' });
          }
        } else {
          if (!isMounted) return;
          setMigrationStatus({ isComplete: true, isRunning: false });
        }
        
        // Load chat metadata (lightweight)
        logger.debug('🔄 [HOOK] Loading chat list from DB');
        const chatMetadata = await loadAllChatMetadata();
        
        if (!isMounted) return;
        
        setChatList(chatMetadata.map(chat => ({
          id: chat.id,
          name: chat.name,
          createdAt: chat.createdAt,
          lastMessageTime: chat.lastMessageTime,
          messageCount: chat.messageCount,
          participantCount: chat.participantCount,
          participants: chat.participants
        })));
        
        logger.info('📥 [HOOK] Loaded chat list:', chatMetadata.length);
      } catch (err) {
        logger.error('❌ [HOOK] Failed to initialize chats:', err);
        if (isMounted) {
          setError('Failed to load chat data');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
        logger.debug('🔄 [HOOK] initializeChats: end');
      }
    };
    
    initializeChats();
    
    // Cleanup function to prevent state updates on unmounted component
    return () => {
      isMounted = false;
      logger.debug('🔄 [HOOK] useEffect: cleanup, isMounted = false');
    };
  }, []);

  /**
   * Load a specific chat with full message data (lazy loading)
   */
  const loadChatData = useCallback(async (chatId: string): Promise<Chat | null> => {
    logger.info('💬 [HOOK] loadChatData called for chat:', chatId);
    // Return cached chat if available
    if (loadedChats.has(chatId)) {
      logger.debug('💬 [HOOK] loadChatData: returning cached chat', chatId);
      return loadedChats.get(chatId)!;
    }

    setIsLoadingChat(chatId);
    performanceMonitor.startTimer(`loadChatData_${chatId}`);

    try {
      logger.debug('💬 [HOOK] loadChatData: loading from DB', chatId);
      const chat = await loadChat(chatId);
      
      if (chat) {
        // Cache the loaded chat
        setLoadedChats(prev => new Map(prev).set(chatId, chat));
        logger.info('💬 [HOOK] loadChatData: loaded and cached', chatId);
      }
      
      return chat;
    } catch (err) {
      logger.error(`❌ [HOOK] Failed to load chat ${chatId}:`, err);
      setError(`Failed to load chat: ${chatId}`);
      return null;
    } finally {
      setIsLoadingChat(null);
      performanceMonitor.endTimer(`loadChatData_${chatId}`);
      logger.debug('💬 [HOOK] loadChatData: end for', chatId);
    }
  }, [loadedChats]);

  /**
   * Add a new chat
   */
  const addChat = useCallback(async (chat: Chat): Promise<void> => {
    logger.info('➕ [HOOK] addChat called for chat:', chat.id);
    performanceMonitor.startTimer('addChat');
    
    try {
      logger.debug('➕ [HOOK] addChat: saving to DB', chat.id);
      // Save to database
      await saveChat(chat);
      
      // Update chat list
      setChatList(prev => {
        const newItem: ChatListItem = {
          id: chat.id,
          name: chat.name,
          createdAt: chat.createdAt,
          lastMessageTime: chat.lastMessageTime,
          messageCount: chat.messages.length,
          participantCount: [...new Set(chat.messages.filter(m => !m.isSystemMessage).map(m => m.sender))].length,
          participants: [...new Set(chat.messages.filter(m => !m.isSystemMessage).map(m => m.sender))]
        };
        
        logger.debug('➕ [HOOK] addChat: updating chatList state', newItem);
        return [newItem, ...prev];
      });
      
      // Cache the chat
      setLoadedChats(prev => new Map(prev).set(chat.id, chat));
      logger.info('➕ [HOOK] addChat: added and cached', chat.id);
      
    } catch (err) {
      logger.error('❌ [HOOK] Failed to add chat:', err);
      setError('Failed to save chat');
      throw err;
    } finally {
      performanceMonitor.endTimer('addChat');
      logger.debug('➕ [HOOK] addChat: end for', chat.id);
    }
  }, []);

  /**
   * Delete a chat
   */
  const removeChat = useCallback(async (chatId: string): Promise<void> => {
    logger.info('🗑️ [HOOK] removeChat called for chat:', chatId);
    performanceMonitor.startTimer('removeChat');
    
    try {
      logger.debug('🗑️ [HOOK] removeChat: deleting from DB', chatId);
      // Delete from database
      await deleteChat(chatId);
      
      // Update chat list
      setChatList(prev => prev.filter(chat => chat.id !== chatId));
      
      // Remove from cache
      setLoadedChats(prev => {
        const newMap = new Map(prev);
        newMap.delete(chatId);
        logger.debug('🗑️ [HOOK] removeChat: removed from cache', chatId);
        return newMap;
      });
      
      logger.info('🗑️ [HOOK] removeChat: deleted', chatId);
    } catch (err) {
      logger.error('❌ [HOOK] Failed to delete chat:', err);
      setError('Failed to delete chat');
      throw err;
    } finally {
      performanceMonitor.endTimer('removeChat');
      logger.debug('🗑️ [HOOK] removeChat: end for', chatId);
    }
  }, []);

  /**
   * Get a chat from cache (synchronous)
   */
  const getCachedChat = useCallback((chatId: string): Chat | null => {
    const result = loadedChats.get(chatId) || null;
    logger.debug('💾 [HOOK] getCachedChat called for', chatId, 'result:', !!result);
    return result;
  }, [loadedChats]);

  /**
   * Preload multiple chats (useful for background loading)
   */
  const preloadChats = useCallback(async (chatIds: string[]): Promise<void> => {
    const unloadedIds = chatIds.filter(id => !loadedChats.has(id));
    
    if (unloadedIds.length === 0) return;
    
    performanceMonitor.startTimer('preloadChats');
    
    try {
      const chats = await Promise.all(
        unloadedIds.map(id => loadChat(id))
      );
      
      // Cache all loaded chats
      setLoadedChats(prev => {
        const newMap = new Map(prev);
        chats.forEach((chat, index) => {
          if (chat) {
            newMap.set(unloadedIds[index], chat);
          }
        });
        return newMap;
      });
      
    } catch (err) {
      logger.error('Failed to preload chats:', err);
    } finally {
      performanceMonitor.endTimer('preloadChats');
    }
  }, [loadedChats]);

  /**
   * Clear chat cache to free memory
   */
  const clearCache = useCallback(() => {
    setLoadedChats(new Map());
  }, []);

  /**
   * Refresh chat list
   */
  const refreshChatList = useCallback(async () => {
    try {
      setIsLoading(true);
      const chatMetadata = await loadAllChatMetadata();
      setChatList(chatMetadata.map(chat => ({
        id: chat.id,
        name: chat.name,
        createdAt: chat.createdAt,
        lastMessageTime: chat.lastMessageTime,
        messageCount: chat.messageCount,
        participantCount: chat.participantCount,
        participants: chat.participants
      })));
      setError(null);
    } catch (err) {
      logger.error('Failed to refresh chat list:', err);
      setError('Failed to refresh chat data');
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

  return {
    // Data
    chatList,
    loadedChats: Array.from(loadedChats.values()),
    
    // Loading states
    isLoading,
    isLoadingChat,
    migrationStatus,
    error,
    
    // Actions
    loadChatData,
    addChat,
    removeChat,
    getCachedChat,
    preloadChats,
    clearCache,
    refreshChatList,
    clearError
  };
};
