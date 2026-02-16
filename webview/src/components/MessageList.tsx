import React, { useRef, useEffect } from 'react';
import { SimpleUserMessage } from './Message/SimpleUserMessage';
import { SimpleAssistantMessage } from './Message/SimpleAssistantMessage';
import type { Message } from '../types';
import styles from './MessageList.module.css';

interface MessageListProps {
  messages: Message[];
}

export const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  console.log('[MessageList] Rendering with', messages.length, 'messages');
  
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (parentRef.current) {
      parentRef.current.scrollTop = parentRef.current.scrollHeight;
    }
  }, [messages.length]);
  
  if (messages.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>
          <span className="codicon codicon-comment-discussion" />
        </div>
        <p className={styles.emptyText}>Start a conversation with CodeLab</p>
      </div>
    );
  }
  
  return (
    <div className={styles.container} ref={parentRef}>
      {messages.map((message) => {
        if (message.role === 'user') {
          return <SimpleUserMessage key={message.id} message={message} />;
        }
        return <SimpleAssistantMessage key={message.id} message={message} />;
      })}
    </div>
  );
};
