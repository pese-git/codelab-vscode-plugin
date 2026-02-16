import React from 'react';
import type { Message } from '../../types';
import styles from './Message.module.css';

interface SimpleUserMessageProps {
  message: Message;
}

const formatTime = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return date.toLocaleTimeString();
  } catch (error) {
    return 'Invalid Date';
  }
};

export const SimpleUserMessage: React.FC<SimpleUserMessageProps> = ({ message }) => {
  return (
    <div className={styles.messageWrapper}>
      <div className={`${styles.message} ${styles.userMessage}`}>
        <div className={styles.messageHeader}>
          <span className={styles.messageRole}>You</span>
          <span className={styles.messageTime}>
            {formatTime(message.timestamp)}
          </span>
        </div>
        <div className={styles.messageContent}>
          {message.content}
        </div>
      </div>
    </div>
  );
};
