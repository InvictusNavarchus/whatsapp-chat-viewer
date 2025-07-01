import { Message } from '@/types/chat';

export const parseWhatsAppChat = (content: string): Message[] => {
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
  
  return messages;
};

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