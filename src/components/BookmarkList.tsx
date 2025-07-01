import { ArrowLeft, Bookmark, MessageCircle } from 'lucide-react';
import { BookmarkedMessage } from '@/types/chat';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import log from 'loglevel';
const logger = log.getLogger('bookmarkList');
logger.setLevel('debug');

interface BookmarkListProps {
  bookmarks: BookmarkedMessage[];
  onBack: () => void;
  onJumpToMessage: (chatId: string, messageId: string) => void;
  onRemoveBookmark: (messageId: string) => void;
}

export const BookmarkList = ({ 
  bookmarks, 
  onBack, 
  onJumpToMessage,
  onRemoveBookmark 
}: BookmarkListProps) => {
  logger.debug('🔖 [COMP] BookmarkList render, bookmark count:', bookmarks.length);

  const handleBookmarkSelect = (messageId: string) => {
    logger.info('🔖 [COMP] handleBookmarkSelect called:', messageId);
    onJumpToMessage(bookmarks.find(b => b.id === messageId)?.chatId || '', messageId);
  };

  const handleRemoveBookmark = (messageId: string) => {
    logger.info('🗑️ [COMP] handleRemoveBookmark called:', messageId);
    onRemoveBookmark(messageId);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-chat-bookmark-active/10">
            <Bookmark className="h-5 w-5 text-chat-bookmark-active" />
          </div>
          <div>
            <h2 className="font-semibold">Bookmarked Messages</h2>
            <p className="text-sm text-muted-foreground">
              {bookmarks.length} saved messages
            </p>
          </div>
        </div>
      </div>

      {/* Bookmarks */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {bookmarks.length === 0 ? (
          <Card className="p-8 text-center">
            <Bookmark className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No bookmarks yet</p>
            <p className="text-xs text-muted-foreground">
              Tap the bookmark icon on any message to save it here
            </p>
          </Card>
        ) : (
          bookmarks.map((bookmark) => (
            <Card 
              key={bookmark.id}
              className="p-4 cursor-pointer transition-all duration-200 hover:shadow-md border hover:border-primary/50"
              onClick={() => handleBookmarkSelect(bookmark.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageCircle className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm font-medium text-primary truncate">
                      {bookmark.chatName}
                    </span>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="text-sm font-medium">{bookmark.sender}</div>
                    <div className="text-sm text-muted-foreground line-clamp-3">
                      {bookmark.content}
                    </div>
                  </div>
                  
                  <div className="mt-2 text-xs text-chat-timestamp">
                    {bookmark.date} {bookmark.time}
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveBookmark(bookmark.id);
                  }}
                  className="text-chat-bookmark-active hover:text-destructive flex-shrink-0"
                >
                  <Bookmark className="h-4 w-4 fill-current" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};