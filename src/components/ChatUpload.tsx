import { useRef } from 'react';
import { Upload, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import log from 'loglevel';
const logger = log.getLogger('chatUpload');
logger.setLevel('debug');

interface ChatUploadProps {
  onFileSelect: (file: File) => void;
  isLoading?: boolean;
}

export const ChatUpload = ({ onFileSelect, isLoading }: ChatUploadProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    logger.info('📁 [COMP] handleFileSelect called');
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
    logger.debug('📁 [COMP] handleFileSelect: end');
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = () => {
    logger.info('📤 [COMP] handleUpload called');
    onFileSelect(fileInputRef.current?.files?.[0] as File);
    logger.debug('📤 [COMP] handleUpload: end');
  };

  return (
    <Card className="p-8 text-center border-dashed border-2 border-muted-foreground/25 bg-accent/50">
      <div className="flex flex-col items-center gap-4">
        <div className="p-4 rounded-full bg-primary/10">
          <MessageCircle className="h-8 w-8 text-primary" />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Import WhatsApp Chat</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Upload your exported WhatsApp chat file (.txt) to view and organize your conversations
          </p>
        </div>

        <Button 
          onClick={handleClick}
          disabled={isLoading}
          className="gap-2"
        >
          <Upload className="h-4 w-4" />
          {isLoading ? 'Processing...' : 'Choose File'}
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".txt"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="text-xs text-muted-foreground">
          <p>To export from WhatsApp:</p>
          <p>Chat → More → Export Chat → Without Media</p>
        </div>
      </div>
    </Card>
  );
};