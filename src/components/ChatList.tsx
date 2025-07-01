import { MessageCircle, Clock, Bookmark } from 'lucide-react';
import { Chat } from '@/types/chat';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ChatListProps {
  chats: Chat[];
  activeChat: string | null;
  onSelectChat: (chatId: string) => void;
  onViewBookmarks: () => void;
  bookmarkCount: number;
}

export const ChatList = ({ 
  chats, 
  activeChat, 
  onSelectChat, 
  onViewBookmarks,
  bookmarkCount 
}: ChatListProps) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your Chats</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={onViewBookmarks}
          className="gap-2"
        >
          <Bookmark className="h-4 w-4" />
          Bookmarks ({bookmarkCount})
        </Button>
      </div>

      <div className="space-y-2">
        {chats.length === 0 ? (
          <Card className="p-6 text-center">
            <MessageCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No chats yet</p>
            <p className="text-xs text-muted-foreground">Upload your first WhatsApp chat to get started</p>
          </Card>
        ) : (
          chats.map((chat) => (
            <Card 
              key={chat.id}
              className={cn(
                "p-4 cursor-pointer transition-all duration-200 hover:shadow-md border",
                activeChat === chat.id && "border-primary bg-accent"
              )}
              onClick={() => onSelectChat(chat.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{chat.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {chat.messages.length} messages
                  </p>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {chat.lastMessageTime}
                </div>
              </div>
              
              <div className="mt-2 text-xs text-muted-foreground">
                Added {chat.createdAt.toLocaleDateString()}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};