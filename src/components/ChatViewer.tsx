import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { Chat, Message } from '@/types/chat';
import { ChatBubble } from './ChatBubble';
import { Button } from '@/components/ui/button';
import { getBookmarkStatus } from '@/utils/normalizedDb';
import { cn } from '@/lib/utils';
import log from 'loglevel';

const logger = log.getLogger('chatViewer');
logger.setLevel('debug');

interface ChatViewerProps {
  chat: Chat;
  onToggleBookmark: (messageId: string) => void;
  onBack: () => void;
  scrollToMessage?: string | null;
  currentUser?: string;
}

export const ChatViewer = ({ 
  chat, 
  onToggleBookmark, 
  onBack, 
  scrollToMessage,
  currentUser 
}: ChatViewerProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [bookmarkStatuses, setBookmarkStatuses] = useState<Record<string, boolean>>({});

  // Auto-detect current user based on most frequent sender
  const detectedCurrentUser = currentUser || (() => {
    const senderCounts: Record<string, number> = {};
    chat.messages.forEach(msg => {
      if (!msg.isSystemMessage) {
        senderCounts[msg.sender] = (senderCounts[msg.sender] || 0) + 1;
      }
    });
    
    const sortedSenders = Object.entries(senderCounts)
      .sort(([,a], [,b]) => b - a);
    
    return sortedSenders[0]?.[0] || '';
  })();

  // Handle bookmark toggle with status refresh
  const handleToggleBookmark = async (messageId: string) => {
    logger.info('🔖 [COMP] handleToggleBookmark called:', messageId);
    await onToggleBookmark(messageId);
    logger.debug('🔖 [COMP] handleToggleBookmark: toggled, refreshing status');
    const status = await getBookmarkStatus([messageId]);
    setBookmarkStatuses(prev => ({
      ...prev,
      ...status
    }));
    logger.info('🔖 [COMP] handleToggleBookmark: status refreshed');
  };

  const handleBack = () => {
    logger.info('⬅️ [COMP] handleBack called');
    onBack();
  };

  // Load bookmark statuses for all messages
  useEffect(() => {
    logger.debug('🔄 [COMP] useEffect: loadBookmarkStatuses called');
    const loadBookmarkStatuses = async () => {
      logger.debug('🔄 [COMP] loadBookmarkStatuses: start');
      try {
        const messageIds = chat.messages.map(m => m.id);
        logger.debug('🔄 [COMP] Loading bookmark statuses for', messageIds.length, 'messages');
        const statuses = await getBookmarkStatus(messageIds);
        setBookmarkStatuses(statuses);
        logger.info('🔖 [COMP] Loaded bookmark statuses');
      } catch (error) {
        logger.error('❌ [COMP] Failed to load bookmark statuses:', error);
      }
      logger.debug('🔄 [COMP] loadBookmarkStatuses: end');
    };
    loadBookmarkStatuses();
    logger.debug('🔄 [COMP] useEffect: loadBookmarkStatuses scheduled');
  }, [chat.messages]);

  useEffect(() => {
    if (scrollToMessage) {
      const messageElement = document.getElementById(`message-${scrollToMessage}`);
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add highlight effect
        messageElement.classList.add('animate-pulse');
        setTimeout(() => {
          messageElement.classList.remove('animate-pulse');
        }, 2000);
      }
    } else {
      // Scroll to bottom for new chats
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [scrollToMessage, chat.id]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleBack}
          className="md:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <MessageCircle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">{chat.name}</h2>
            <p className="text-sm text-muted-foreground">
              {chat.messages.length} messages
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto bg-chat-bg p-4 space-y-3"
      >
        {chat.messages.map((message, index) => (
          <div 
            key={message.id} 
            id={`message-${message.id}`}
            className={cn(
              "transition-all duration-300",
              scrollToMessage === message.id && "ring-2 ring-primary/50 rounded-lg"
            )}
          >
            <ChatBubble
              message={{
                ...message,
                isBookmarked: bookmarkStatuses[message.id] || false
              }}
              isCurrentUser={message.sender === detectedCurrentUser}
              onToggleBookmark={handleToggleBookmark}
            />
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};