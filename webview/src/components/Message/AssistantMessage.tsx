import React, { useMemo } from 'react';
import { marked } from 'marked';
import { CodeBlock } from '../CodeBlock';
import { ActionButtons } from '../ActionButtons';
import type { Message } from '../../types';
import styles from './Message.module.css';

interface AssistantMessageProps {
  message: Message;
}

export const AssistantMessage: React.FC<AssistantMessageProps> = React.memo(({ message }) => {
  const renderedContent = useMemo(() => {
    // Parse markdown and extract code blocks
    const tokens = marked.lexer(message.content);
    
    return tokens.map((token, index) => {
      if (token.type === 'code') {
        return (
          <CodeBlock
            key={index}
            code={token.text}
            language={token.lang || 'text'}
          />
        );
      }
      
      // Render other markdown
      const html = marked.parser([token]);
      return (
        <div 
          key={index}
          className={styles.markdown}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    });
  }, [message.content]);
  
  return (
    <div className={`${styles.message} ${styles.assistantMessage}`}>
      <div className={styles.avatar}>
        <span className="codicon codicon-hubot" />
      </div>
      <div className={styles.content}>
        <div className={styles.text}>
          {renderedContent}
        </div>
        
        <ActionButtons messageId={message.id} hasDiff={!!message.diff} />
        
        <div className={styles.meta}>
          <span className={styles.time}>
            {formatTime(message.timestamp)}
          </span>
          {message.agentId && (
            <span className={styles.agent}>{message.agentId}</span>
          )}
        </div>
      </div>
    </div>
  );
});

AssistantMessage.displayName = 'AssistantMessage';

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
}