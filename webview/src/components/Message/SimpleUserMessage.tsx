import React from 'react';
import type { Message } from '../../types';
import styles from './Message.module.css';

interface SimpleUserMessageProps {
  message: Message;
}

export const SimpleUserMessage: React.FC<SimpleUserMessageProps> = ({ message }) => {
  return (
    <div className={styles.messageWrapper}>
      <div className={`${styles.message} ${styles.userMessage}`}>
        <div className={styles.messageHeader}>
          <span className={styles.messageRole}>You</span>
          <span className={styles.messageTime}>
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        </div>
        <div className={styles.messageContent}>
          {message.content}
        </div>
      </div>
    </div>
  );
};
