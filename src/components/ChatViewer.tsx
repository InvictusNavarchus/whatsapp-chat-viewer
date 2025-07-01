import { useEffect, useRef } from 'react';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { Chat, Message } from '@/types/chat';
import { ChatBubble } from './ChatBubble';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
          onClick={onBack}
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
              message={message}
              isCurrentUser={message.sender === detectedCurrentUser}
              onToggleBookmark={onToggleBookmark}
            />
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};