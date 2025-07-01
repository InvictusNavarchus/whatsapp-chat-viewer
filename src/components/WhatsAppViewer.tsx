import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Chat, Message, BookmarkedMessage } from '@/types/chat';
import { parseWhatsAppChat, generateChatName } from '@/utils/chatParser';
import { saveBookmarks, loadBookmarks, saveActiveChat, loadActiveChat } from '@/utils/localStorage';
import { saveChatsToIndexedDB, loadChatsFromIndexedDB, saveChatToIndexedDB } from '@/utils/indexedDb';
import { migrateChatsFromLocalStorage, hasLegacyChatData } from '@/utils/migration';
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
  const [chats, setChats] = useState<Chat[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkedMessage[]>([]);
  const [currentView, setCurrentView] = useState<ViewState>('list');
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [scrollToMessage, setScrollToMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const { toast } = useToast();

  // Load data from storage on mount
  useEffect(() => {
    const loadInitialData = async () => {
      // Simulate loading time to show skeleton
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Check for legacy data and migrate if needed
      if (hasLegacyChatData()) {
        const migrationSuccess = await migrateChatsFromLocalStorage();
        if (migrationSuccess) {
          toast({
            title: "Data Migration Complete",
            description: "Your chat data has been migrated to improved storage."
          });
        }
      }
      
      const savedChats = await loadChatsFromIndexedDB();
      const savedBookmarks = loadBookmarks();
      const savedActiveChat = loadActiveChat();
      
      setChats(savedChats);
      setBookmarks(savedBookmarks);
      
      if (savedChats.length === 0) {
        setCurrentView('upload');
      } else if (savedActiveChat && savedChats.find(c => c.id === savedActiveChat)) {
        setActiveChat(savedActiveChat);
        setCurrentView('chat');
      }
      
      setIsInitialLoading(false);
    };
    
    loadInitialData();
  }, [toast]);

  // Save to storage whenever data changes
  useEffect(() => {
    if (!isInitialLoading) {
      saveChatsToIndexedDB(chats).catch(error => {
        console.error('Failed to save chats to IndexedDB:', error);
        toast({
          title: "Storage Error",
          description: "Failed to save chats. Changes may not persist.",
          variant: "destructive"
        });
      });
    }
  }, [chats, isInitialLoading, toast]);

  useEffect(() => {
    saveBookmarks(bookmarks);
  }, [bookmarks]);

  useEffect(() => {
    saveActiveChat(activeChat);
  }, [activeChat]);

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

      setChats(prev => [newChat, ...prev]);
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

  const handleSelectChat = (chatId: string) => {
    setActiveChat(chatId);
    setScrollToMessage(null);
    setCurrentView('chat');
  };

  const handleToggleBookmark = async (messageId: string) => {
    const currentChat = chats.find(c => c.id === activeChat);
    if (!currentChat) return;

    // Update the message in the chat
    const updatedChats = chats.map(chat => {
      if (chat.id !== activeChat) return chat;
      
      return {
        ...chat,
        messages: chat.messages.map(msg => {
          if (msg.id !== messageId) return msg;
          return { ...msg, isBookmarked: !msg.isBookmarked };
        })
      };
    });

    setChats(updatedChats);

    // Update bookmarks
    const message = currentChat.messages.find(m => m.id === messageId);
    if (!message) return;

    if (message.isBookmarked) {
      // Remove bookmark
      setBookmarks(prev => prev.filter(b => b.id !== messageId));
    } else {
      // Add bookmark
      const bookmark: BookmarkedMessage = {
        ...message,
        isBookmarked: true,
        chatId: currentChat.id,
        chatName: currentChat.name
      };
      setBookmarks(prev => [bookmark, ...prev]);
    }
  };

  const handleJumpToMessage = (chatId: string, messageId: string) => {
    setActiveChat(chatId);
    setScrollToMessage(messageId);
    setCurrentView('chat');
  };

  const handleRemoveBookmark = async (messageId: string) => {
    setBookmarks(prev => prev.filter(b => b.id !== messageId));
    
    // Also update the message in the chat
    const updatedChats = chats.map(chat => ({
      ...chat,
      messages: chat.messages.map(msg => {
        if (msg.id !== messageId) return msg;
        return { ...msg, isBookmarked: false };
      })
    }));
    
    setChats(updatedChats);
  };

  const currentChat = chats.find(c => c.id === activeChat);

  if (isInitialLoading) {
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
                chats={chats}
                activeChat={activeChat}
                onSelectChat={handleSelectChat}
                onViewBookmarks={() => setCurrentView('bookmarks')}
                bookmarkCount={bookmarks.length}
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
            
            {currentView === 'chat' && currentChat && (
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
                  chats={chats}
                  activeChat={activeChat}
                  onSelectChat={handleSelectChat}
                  onViewBookmarks={() => setCurrentView('bookmarks')}
                  bookmarkCount={bookmarks.length}
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
          
          {currentView === 'chat' && currentChat && (
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