import { useState } from 'react';
import { Bookmark } from 'lucide-react';
import { Message } from '@/types/chat';
import { cn } from '@/lib/utils';
import log from 'loglevel';

const logger = log.getLogger('chatBubble');
logger.setLevel('debug');

interface ChatBubbleProps {
  message: Message;
  isCurrentUser: boolean;
  onToggleBookmark: (messageId: string) => void;
}

export const ChatBubble = ({ message, isCurrentUser, onToggleBookmark }: ChatBubbleProps) => {
  const [showTimestamp, setShowTimestamp] = useState(false);

  if (message.isSystemMessage) {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-muted px-3 py-1 rounded-full text-xs text-chat-system max-w-xs text-center">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "flex gap-2 group",
        isCurrentUser ? "justify-end" : "justify-start"
      )}
      onClick={() => setShowTimestamp(!showTimestamp)}
    >
      <div 
        className={cn(
          "relative max-w-xs lg:max-w-md xl:max-w-lg px-3 py-2 rounded-lg transition-all duration-200",
          isCurrentUser 
            ? "bg-chat-sent text-chat-sent-foreground rounded-br-sm" 
            : "bg-chat-received text-chat-received-foreground rounded-bl-sm",
          "cursor-pointer hover:shadow-md"
        )}
      >
        {!isCurrentUser && (
          <div className="text-xs font-medium text-primary mb-1">
            {message.sender}
          </div>
        )}
        
        <div className="text-sm whitespace-pre-wrap break-words">
          {message.content}
        </div>
        
        <div className="flex items-center justify-between mt-1 gap-2">
          <div className="text-xs text-chat-timestamp opacity-70">
            {message.time}
          </div>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleBookmark(message.id);
            }}
            className={cn(
              "opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded-full hover:bg-black/10",
              message.isBookmarked && "opacity-100 text-chat-bookmark-active"
            )}
          >
            <Bookmark 
              className={cn(
                "h-3 w-3",
                message.isBookmarked && "fill-current"
              )} 
            />
          </button>
        </div>
      </div>
      
      {showTimestamp && (
        <div className="absolute mt-12 px-2 py-1 bg-black/75 text-white text-xs rounded z-10">
          {message.date} {message.time}
        </div>
      )}
    </div>
  );
};