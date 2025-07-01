/**
 * Web Worker for parsing WhatsApp chat files
 * Processes large chat files in chunks to avoid blocking the main thread
 */

interface ParsedMessage {
  id: string;
  date: string;
  time: string;
  sender: string;
  content: string;
  isBookmarked: boolean;
  isSystemMessage: boolean;
}

interface ParseResult {
  messages: ParsedMessage[];
  chatName: string;
  participants: string[];
  messageCount: number;
}

interface ProgressUpdate {
  type: 'progress';
  progress: number;
  totalLines: number;
  processedLines: number;
}

interface CompleteUpdate {
  type: 'complete';
  result: ParseResult;
}

interface ErrorUpdate {
  type: 'error';
  error: string;
}

type WorkerMessage = ProgressUpdate | CompleteUpdate | ErrorUpdate;

const CHUNK_SIZE = 1000; // Process 1000 lines at a time
const messageRegex = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2})\s*-\s*(.+)$/;

/**
 * Parse WhatsApp chat content in chunks with progress reporting
 */
const parseWhatsAppChatInChunks = async (content: string): Promise<void> => {
  try {
    const lines = content.split('\n').filter(line => line.trim());
    const totalLines = lines.length;
    const messages: ParsedMessage[] = [];
    const participants = new Set<string>();
    
    // Process lines in chunks
    for (let i = 0; i < lines.length; i += CHUNK_SIZE) {
      const chunk = lines.slice(i, i + CHUNK_SIZE);
      
      // Process each line in the chunk
      for (const line of chunk) {
        const match = line.match(messageRegex);
        
        if (match) {
          const [, date, time, rest] = match;
          
          // Check if it's a system message (no sender, just content)
          const senderContentMatch = rest.match(/^([^:]+):\s*(.*)$/);
          
          let sender: string;
          let content: string;
          let isSystemMessage = false;
          
          if (senderContentMatch) {
            [, sender, content] = senderContentMatch;
            sender = sender.trim();
            content = content.trim();
            
            // Track participants during parsing (single pass)
            if (!isSystemMessage && sender !== 'System') {
              participants.add(sender);
            }
          } else {
            // System message
            sender = 'System';
            content = rest.trim();
            isSystemMessage = true;
          }
          
          messages.push({
            id: `${date}-${time}-${Math.random().toString(36).substr(2, 9)}`,
            date: date.trim(),
            time: time.trim(),
            sender,
            content,
            isBookmarked: false,
            isSystemMessage
          });
        }
      }
      
      // Report progress
      const processedLines = Math.min(i + CHUNK_SIZE, totalLines);
      const progress = Math.round((processedLines / totalLines) * 100);
      
      self.postMessage({
        type: 'progress',
        progress,
        totalLines,
        processedLines
      } as ProgressUpdate);
      
      // Yield control back to prevent blocking
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    // Generate chat name from participants (single pass, no redundant iteration)
    const participantList = Array.from(participants);
    let chatName: string;
    
    if (participantList.length === 0) {
      chatName = 'Empty Chat';
    } else if (participantList.length === 1) {
      chatName = `${participantList[0]} (Notes)`;
    } else if (participantList.length === 2) {
      chatName = participantList.join(' & ');
    } else {
      chatName = `${participantList.slice(0, 2).join(', ')} +${participantList.length - 2} others`;
    }
    
    // Send completion result
    self.postMessage({
      type: 'complete',
      result: {
        messages,
        chatName,
        participants: participantList,
        messageCount: messages.length
      }
    } as CompleteUpdate);
    
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown parsing error'
    } as ErrorUpdate);
  }
};

// Handle incoming messages
self.onmessage = (event) => {
  const { content } = event.data;
  parseWhatsAppChatInChunks(content);
};

export {};
