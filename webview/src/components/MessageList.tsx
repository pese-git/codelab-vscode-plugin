import React, { useRef, useEffect } from 'react';
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
      {messages.map((message) => (
        <div
          key={message.id}
          style={{
            padding: '12px',
            marginBottom: '8px',
            borderRadius: '4px',
            backgroundColor: message.role === 'user'
              ? 'var(--vscode-input-background)'
              : 'var(--vscode-editor-background)',
            border: '1px solid var(--vscode-panel-border)'
          }}
        >
          <div style={{
            fontWeight: 'bold',
            marginBottom: '4px',
            color: message.role === 'user'
              ? 'var(--vscode-textLink-foreground)'
              : 'var(--vscode-textPreformat-foreground)'
          }}>
            {message.role === 'user' ? 'You' : 'Assistant'}
          </div>
          <div style={{ whiteSpace: 'pre-wrap' }}>
            {message.content}
          </div>
        </div>
      ))}
    </div>
  );
};
