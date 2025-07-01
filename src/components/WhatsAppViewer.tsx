import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Chat, Message, BookmarkedMessage } from '@/types/chat';
import { parseWhatsAppChat, generateChatName } from '@/utils/chatParser';
import { saveActiveChat, loadActiveChat } from '@/utils/localStorage';
import { useBookmarks } from '@/hooks/useBookmarks';
import { useChats } from '@/hooks/useChats';
import { ChatUpload } from './ChatUpload';
import { ChatList } from './ChatList';
import { ChatViewer } from './ChatViewer';
import { BookmarkList } from './BookmarkList';
import { ChatListSkeleton } from './ChatListSkeleton';
import { ChatViewerSkeleton } from './ChatViewerSkeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type ViewState = 'list' | 'chat' | 'bookmarks' | 'upload';

export const WhatsAppViewer = () => {
  const [currentView, setCurrentView] = useState<ViewState>('list');
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [scrollToMessage, setScrollToMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingChatId, setLoadingChatId] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Use the new efficient database systems
  const { 
    chatList,
    isLoading: isLoadingChats,
    isLoadingChat,
    migrationStatus,
    error: chatError,
    loadChatData,
    addChat,
    getCachedChat,
    clearError: clearChatError
  } = useChats();
  
  const { 
    bookmarks, 
    addBookmark, 
    deleteBookmark, 
    toggleBookmark, 
    isBookmarked: isMessageBookmarked,
    error: bookmarkError,
    clearError: clearBookmarkError
  } = useBookmarks();

  // Load data from storage on mount and handle migration
  useEffect(() => {
    const loadInitialData = async () => {
      const savedActiveChat = loadActiveChat();
      
      if (chatList.length === 0) {
        setCurrentView('upload');
      } else if (savedActiveChat && chatList.find(c => c.id === savedActiveChat)) {
        setActiveChat(savedActiveChat);
        setCurrentView('chat');
      }
    };
    
    if (!isLoadingChats && !migrationStatus.isRunning) {
      loadInitialData();
    }
  }, [chatList, isLoadingChats, migrationStatus.isRunning]);

  // Show migration status
  useEffect(() => {
    if (migrationStatus.isRunning) {
      toast({
        title: "Migrating Data",
        description: "Upgrading to improved storage format...",
      });
    } else if (migrationStatus.isComplete && migrationStatus.error) {
      toast({
        title: "Migration Error",
        description: migrationStatus.error,
        variant: "destructive"
      });
    }
  }, [migrationStatus, toast]);

  // Show error toasts
  useEffect(() => {
    if (chatError) {
      toast({
        title: "Chat Error", 
        description: chatError,
        variant: "destructive"
      });
    }
  }, [chatError, toast]);

  useEffect(() => {
    if (bookmarkError) {
      toast({
        title: "Bookmark Error",
        description: bookmarkError,
        variant: "destructive"
      });
    }
  }, [bookmarkError, toast]);

  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    
    try {
      const content = await file.text();
      const messages = parseWhatsAppChat(content);
      
      if (messages.length === 0) {
        toast({
          title: "No messages found",
          description: "The file doesn't contain valid WhatsApp messages.",
          variant: "destructive"
        });
        return;
      }

      const chatName = generateChatName(messages);
      const newChat: Chat = {
        id: `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: chatName,
        messages,
        createdAt: new Date(),
        lastMessageTime: messages[messages.length - 1]?.time || 'Unknown'
      };

      await addChat(newChat);
      setActiveChat(newChat.id);
      setCurrentView('chat');
      
      toast({
        title: "Chat imported successfully",
        description: `${messages.length} messages loaded from "${chatName}"`
      });
      
    } catch (error) {
      console.error('Error parsing chat file:', error);
      toast({
        title: "Import failed",
        description: "Failed to parse the chat file. Please check the format.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles chat selection with loading state feedback
   * @param chatId - The ID of the chat to select
   */
  const handleSelectChat = async (chatId: string) => {
    setLoadingChatId(chatId);
    setScrollToMessage(null);
    
    // Load chat data if not already cached
    await loadChatData(chatId);
    
    setActiveChat(chatId);
    setCurrentView('chat');
    saveActiveChat(chatId);
    
    // Clear loading state
    setLoadingChatId(null);
  };

  const handleToggleBookmark = async (messageId: string) => {
    const currentChat = getCachedChat(activeChat!);
    if (!currentChat || !activeChat) return;

    const message = currentChat.messages.find(m => m.id === messageId);
    if (!message) return;

    // Create the bookmark object
    const bookmark: BookmarkedMessage = {
      ...message,
      isBookmarked: !message.isBookmarked,
      chatId: currentChat.id,
      chatName: currentChat.name
    };

    // Use the efficient bookmark toggle
    await toggleBookmark(bookmark);
  };

  const handleJumpToMessage = async (chatId: string, messageId: string) => {
    // Load the chat if not cached
    await loadChatData(chatId);
    
    setActiveChat(chatId);
    setScrollToMessage(messageId);
    setCurrentView('chat');
  };

  const handleRemoveBookmark = async (messageId: string) => {
    // Remove the bookmark using the efficient system
    await deleteBookmark(messageId);
  };

  const currentChat = activeChat ? getCachedChat(activeChat) : null;

  if (isLoadingChats || migrationStatus.isRunning) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto">
          {/* Desktop Loading */}
          <div className="hidden md:flex h-screen">
            <div className="w-80 border-r bg-card flex flex-col">
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <h1 className="text-xl font-bold">WhatsApp Viewer</h1>
                  <Button size="sm" disabled className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Chat
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <ChatListSkeleton />
              </div>
            </div>
            <div className="flex-1">
              <ChatViewerSkeleton />
            </div>
          </div>
          
          {/* Mobile Loading */}
          <div className="md:hidden h-screen">
            <div className="p-4 border-b bg-card">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold">WhatsApp Viewer</h1>
                <Button size="sm" disabled className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <ChatListSkeleton />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile/Desktop Layout */}
      <div className="max-w-6xl mx-auto">
        {/* Desktop Layout */}
        <div className="hidden md:flex h-screen">
          {/* Sidebar */}
          <div className="w-80 border-r bg-card flex flex-col">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold">WhatsApp Viewer</h1>
                <Button
                  size="sm"
                  onClick={() => setCurrentView('upload')}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Chat
                </Button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <ChatList
                chats={chatList.map(chat => ({
                  id: chat.id,
                  name: chat.name,
                  messages: [], // We don't need full messages for the list
                  createdAt: chat.createdAt,
                  lastMessageTime: chat.lastMessageTime
                }))}
                activeChat={activeChat}
                onSelectChat={handleSelectChat}
                onViewBookmarks={() => setCurrentView('bookmarks')}
                bookmarkCount={bookmarks.length}
                loadingChatId={loadingChatId}
              />
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {currentView === 'upload' && (
              <div className="h-full flex items-center justify-center p-8">
                <div className="w-full max-w-md">
                  <ChatUpload 
                    onFileSelect={handleFileUpload}
                    isLoading={isLoading}
                  />
                </div>
              </div>
            )}
            
            {currentView === 'chat' && loadingChatId && (
              <ChatViewerSkeleton />
            )}
            
            {currentView === 'chat' && currentChat && !loadingChatId && (
              <ChatViewer
                chat={currentChat}
                onToggleBookmark={handleToggleBookmark}
                onBack={() => setCurrentView('list')}
                scrollToMessage={scrollToMessage}
              />
            )}
            
            {currentView === 'bookmarks' && (
              <BookmarkList
                bookmarks={bookmarks}
                onBack={() => setCurrentView('list')}
                onJumpToMessage={handleJumpToMessage}
                onRemoveBookmark={handleRemoveBookmark}
              />
            )}
            
            {currentView === 'list' && !currentChat && (
              <div className="h-full flex items-center justify-center p-8">
                <div className="text-center">
                  <h2 className="text-lg font-semibold mb-2">Select a chat</h2>
                  <p className="text-muted-foreground">Choose a chat from the sidebar to start viewing messages</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="md:hidden h-screen">
          {currentView === 'list' && (
            <div className="h-full flex flex-col">
              <div className="p-4 border-b bg-card">
                <div className="flex items-center justify-between">
                  <h1 className="text-xl font-bold">WhatsApp Viewer</h1>
                  <Button
                    size="sm"
                    onClick={() => setCurrentView('upload')}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
                <ChatList
                  chats={chatList.map(chat => ({
                    id: chat.id,
                    name: chat.name,
                    messages: [], // We don't need full messages for the list
                    createdAt: chat.createdAt,
                    lastMessageTime: chat.lastMessageTime
                  }))}
                  activeChat={activeChat}
                  onSelectChat={handleSelectChat}
                  onViewBookmarks={() => setCurrentView('bookmarks')}
                  bookmarkCount={bookmarks.length}
                  loadingChatId={loadingChatId}
                />
              </div>
            </div>
          )}
          
          {currentView === 'upload' && (
            <div className="h-full flex items-center justify-center p-4">
              <div className="w-full max-w-md">
                <div className="mb-4">
                  <Button
                    variant="ghost"
                    onClick={() => setCurrentView('list')}
                    className="mb-4"
                  >
                    ← Back to Chats
                  </Button>
                </div>
                <ChatUpload 
                  onFileSelect={handleFileUpload}
                  isLoading={isLoading}
                />
              </div>
            </div>
          )}
          
          {currentView === 'chat' && loadingChatId && (
            <ChatViewerSkeleton />
          )}
          
          {currentView === 'chat' && currentChat && !loadingChatId && (
            <ChatViewer
              chat={currentChat}
              onToggleBookmark={handleToggleBookmark}
              onBack={() => setCurrentView('list')}
              scrollToMessage={scrollToMessage}
            />
          )}
          
          {currentView === 'bookmarks' && (
            <BookmarkList
              bookmarks={bookmarks}
              onBack={() => setCurrentView('list')}
              onJumpToMessage={handleJumpToMessage}
              onRemoveBookmark={handleRemoveBookmark}
            />
          )}
        </div>
      </div>
    </div>
  );
};