import React from 'react';
import { VSCodeProgressRing } from '@vscode/webview-ui-toolkit/react';
import type { Message } from '../../types';
import styles from './Message.module.css';

interface ProgressMessageProps {
  message: Message;
}

export const ProgressMessage: React.FC<ProgressMessageProps> = React.memo(({ message }) => {
  const progress = message.progress || 0;
  
  return (
    <div className={`${styles.message} ${styles.progressMessage}`}>
      <div className={styles.avatar}>
        <VSCodeProgressRing />
      </div>
      <div className={styles.content}>
        <div className={styles.progressInfo}>
          <div className={styles.progressText}>{message.content}</div>
          <div className={styles.progressPercent}>{progress}%</div>
        </div>
      </div>
    </div>
  );
});

ProgressMessage.displayName = 'ProgressMessage';
