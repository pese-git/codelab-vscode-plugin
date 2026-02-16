import React from 'react';
import type { Message } from '../../types';
import styles from './Message.module.css';

interface UserMessageProps {
  message: Message;
}

export const UserMessage: React.FC<UserMessageProps> = React.memo(({ message }) => {
  return (
    <div className={`${styles.message} ${styles.userMessage}`}>
      <div className={styles.avatar}>
        <span className="codicon codicon-account" />
      </div>
      <div className={styles.content}>
        <div className={styles.text}>
          {message.content}
        </div>
        <div className={styles.meta}>
          <span className={styles.time}>
            {formatTime(message.timestamp)}
          </span>
        </div>
      </div>
    </div>
  );
});

UserMessage.displayName = 'UserMessage';

function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return 'Invalid Date';
  }
}
