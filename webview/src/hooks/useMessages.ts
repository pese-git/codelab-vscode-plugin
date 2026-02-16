import { useState, useCallback } from 'react';
import type { Message } from '../types';

export function useMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const addMessage = useCallback((message: Message) => {
    setMessages(prev => [...prev, message]);
  }, []);
  
  const setMessagesDirectly = useCallback((newMessages: Message[]) => {
    setMessages(newMessages);
  }, []);
  
  const updateProgress = useCallback((
    messageId: string,
    progress: number,
    text?: string
  ) => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId
        ? { ...msg, progress, content: text || msg.content }
        : msg
    ));
  }, []);
  
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);
  
  return {
    messages,
    addMessage,
    setMessagesDirectly,
    updateProgress,
    clearMessages,
    isLoading,
    setIsLoading
  };
}
