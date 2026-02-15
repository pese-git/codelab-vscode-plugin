import React, { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { UserMessage } from './Message/UserMessage';
import { AssistantMessage } from './Message/AssistantMessage';
import { ProgressMessage } from './Message/ProgressMessage';
import type { Message } from '../types';
import styles from './MessageList.module.css';

interface MessageListProps {
  messages: Message[];
}

export const MessageList: React.FC<MessageListProps> = React.memo(({ messages }) => {
  console.log('[MessageList] Rendering with', messages.length, 'messages');
  
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5
  });
  
  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (parentRef.current) {
      console.log('[MessageList] Auto-scrolling to bottom');
      parentRef.current.scrollTop = parentRef.current.scrollHeight;
    }
  }, [messages.length]);
  
  const renderMessage = (message: Message) => {
    console.log('[MessageList] Rendering message:', message.id, message.role);
    
    if (message.isProgress) {
      return <ProgressMessage key={message.id} message={message} />;
    }
    
    if (message.role === 'user') {
      return <UserMessage key={message.id} message={message} />;
    }
    
    return <AssistantMessage key={message.id} message={message} />;
  };
  
  if (messages.length === 0) {
    console.log('[MessageList] No messages, showing empty state');
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>
          <span className="codicon codicon-comment-discussion" />
        </div>
        <p className={styles.emptyText}>Start a conversation with CodeLab</p>
      </div>
    );
  }
  
  console.log('[MessageList] Rendering message list container');
  
  return (
    <div className={styles.container} ref={parentRef}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {virtualizer.getVirtualItems().map(virtualItem => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`
            }}
          >
            {renderMessage(messages[virtualItem.index])}
          </div>
        ))}
      </div>
    </div>
  );
});

MessageList.displayName = 'MessageList';
