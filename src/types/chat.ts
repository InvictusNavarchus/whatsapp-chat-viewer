export interface Message {
  id: string;
  date: string;
  time: string;
  sender: string;
  content: string;
  isBookmarked: boolean;
  isSystemMessage: boolean;
}

export interface Chat {
  id: string;
  name: string;
  messages: Message[];
  createdAt: Date;
  lastMessageTime: string;
}

export interface BookmarkedMessage extends Message {
  chatId: string;
  chatName: string;
}