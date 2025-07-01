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
    const initializeChats = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Check if migration is needed
        const needsMigration = await needsMigrationFromOldDb();
        
        if (needsMigration) {
          console.log('Migration needed, starting migration process...');
          setMigrationStatus({ isComplete: false, isRunning: true });
          
          const migrationResult = await performFullMigration();
          
          if (migrationResult.success) {
            setMigrationStatus({ isComplete: true, isRunning: false });
            
            // Clean up old database in background
            cleanupOldDatabase().catch(console.error);
            
            console.log('Migration completed:', migrationResult);
          } else {
            setMigrationStatus({ 
              isComplete: false, 
              isRunning: false, 
              error: 'Migration failed' 
            });
            setError('Failed to migrate data from old format');
          }
        } else {
          setMigrationStatus({ isComplete: true, isRunning: false });
        }
        
        // Load chat metadata (lightweight)
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
        
      } catch (err) {
        console.error('Failed to initialize chats:', err);
        setError('Failed to load chat data');
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeChats();
  }, []);

  /**
   * Load a specific chat with full message data (lazy loading)
   */
  const loadChatData = useCallback(async (chatId: string): Promise<Chat | null> => {
    // Return cached chat if available
    if (loadedChats.has(chatId)) {
      return loadedChats.get(chatId)!;
    }

    setIsLoadingChat(chatId);
    performanceMonitor.startTimer(`loadChatData_${chatId}`);

    try {
      const chat = await loadChat(chatId);
      
      if (chat) {
        // Cache the loaded chat
        setLoadedChats(prev => new Map(prev).set(chatId, chat));
      }
      
      return chat;
    } catch (err) {
      console.error(`Failed to load chat ${chatId}:`, err);
      setError(`Failed to load chat: ${chatId}`);
      return null;
    } finally {
      setIsLoadingChat(null);
      performanceMonitor.endTimer(`loadChatData_${chatId}`);
    }
  }, [loadedChats]);

  /**
   * Add a new chat
   */
  const addChat = useCallback(async (chat: Chat): Promise<void> => {
    performanceMonitor.startTimer('addChat');
    
    try {
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
        
        return [newItem, ...prev];
      });
      
      // Cache the chat
      setLoadedChats(prev => new Map(prev).set(chat.id, chat));
      
    } catch (err) {
      console.error('Failed to add chat:', err);
      setError('Failed to save chat');
      throw err;
    } finally {
      performanceMonitor.endTimer('addChat');
    }
  }, []);

  /**
   * Delete a chat
   */
  const removeChat = useCallback(async (chatId: string): Promise<void> => {
    performanceMonitor.startTimer('removeChat');
    
    try {
      // Delete from database
      await deleteChat(chatId);
      
      // Update chat list
      setChatList(prev => prev.filter(chat => chat.id !== chatId));
      
      // Remove from cache
      setLoadedChats(prev => {
        const newMap = new Map(prev);
        newMap.delete(chatId);
        return newMap;
      });
      
    } catch (err) {
      console.error('Failed to delete chat:', err);
      setError('Failed to delete chat');
      throw err;
    } finally {
      performanceMonitor.endTimer('removeChat');
    }
  }, []);

  /**
   * Get a chat from cache (synchronous)
   */
  const getCachedChat = useCallback((chatId: string): Chat | null => {
    return loadedChats.get(chatId) || null;
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
      console.error('Failed to preload chats:', err);
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
      console.error('Failed to refresh chat list:', err);
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
