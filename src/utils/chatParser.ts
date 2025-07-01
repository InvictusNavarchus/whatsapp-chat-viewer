import { Message } from '@/types/chat';
import log from 'loglevel';

const logger = log.getLogger('chatParser');
logger.setLevel('debug');

interface ParseResult {
  messages: Message[];
  chatName: string;
  participants: string[];
  messageCount: number;
}

interface ParseProgressCallback {
  (progress: number, processedLines: number, totalLines: number): void;
}

/**
 * Parse WhatsApp chat using Web Worker for better performance
 * @param content - The raw chat file content
 * @param onProgress - Optional callback for progress updates
 * @returns Promise resolving to parsed chat data
 */
export const parseWhatsAppChat = async (
  content: string,
  onProgress?: ParseProgressCallback
): Promise<ParseResult> => {
  logger.info('Starting parseWhatsAppChat');
  return new Promise((resolve, reject) => {
    // Create Web Worker for parsing
    const worker = new Worker(
      new URL('../workers/chatParser.worker.ts', import.meta.url),
      { type: 'module' }
    );
    
    worker.onmessage = (event) => {
      const message = event.data;
      
      switch (message.type) {
        case 'progress':
          if (onProgress) {
            onProgress(message.progress, message.processedLines, message.totalLines);
          }
          break;
          
        case 'complete':
          worker.terminate();
          logger.info('parseWhatsAppChat completed');
          resolve(message.result);
          break;
          
        case 'error':
          worker.terminate();
          logger.error(`parseWhatsAppChat error: ${message.error}`);
          reject(new Error(message.error));
          break;
      }
    };
    
    worker.onerror = (error) => {
      worker.terminate();
      logger.error(`Worker error: ${error.message}`);
      reject(new Error(`Worker error: ${error.message}`));
    };
    
    // Start parsing
    worker.postMessage({ content });
  });
};

/**
 * Legacy synchronous parser for backward compatibility
 * @deprecated Use parseWhatsAppChat instead
 */
export const parseWhatsAppChatSync = (content: string): Message[] => {
  logger.info('Starting parseWhatsAppChatSync');
  const lines = content.split('\n').filter(line => line.trim());
  const messages: Message[] = [];
  
  const messageRegex = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2})\s*-\s*(.+)$/;
  
  for (const line of lines) {
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
  
  logger.info(`parseWhatsAppChatSync completed. ${messages.length} messages parsed`);
  return messages;
};

/**
 * Generate chat name from messages
 * @deprecated This function is now integrated into the Web Worker parser
 */
export const generateChatName = (messages: Message[]): string => {
  const participants = new Set<string>();
  
  messages.forEach(msg => {
    if (!msg.isSystemMessage && msg.sender !== 'System') {
      participants.add(msg.sender);
    }
  });
  
  const participantList = Array.from(participants);
  
  if (participantList.length === 0) {
    return 'Empty Chat';
  } else if (participantList.length === 1) {
    return `${participantList[0]} (Notes)`;
  } else if (participantList.length === 2) {
    return participantList.join(' & ');
  } else {
    return `${participantList.slice(0, 2).join(', ')} +${participantList.length - 2} others`;
  }
};