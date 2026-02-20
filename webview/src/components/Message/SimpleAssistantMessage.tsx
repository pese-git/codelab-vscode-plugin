import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Message } from '../../types';
import styles from './Message.module.css';

interface SimpleAssistantMessageProps {
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

export const SimpleAssistantMessage: React.FC<SimpleAssistantMessageProps> = ({ message }) => {
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  const roleLabel = message.role === 'system' ? 'System' : 'Assistant';

  return (
    <div className={styles.messageWrapper}>
      <div
        className={`${styles.message} ${styles.assistantMessage} ${
          message.role === 'system' ? styles.systemMessage : ''
        } ${message.isError ? styles.errorMessage : ''}`}
      >
        <div className={styles.messageHeader}>
          <span className={styles.messageRole}>{roleLabel}</span>
          <span className={styles.messageTime}>
            {formatTime(message.timestamp)}
          </span>
        </div>
        <div className={styles.messageContent}>
          <ReactMarkdown
            components={{
              code({ inline, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || '');
                const codeString = String(children).replace(/\n$/, '');
                
                return !inline && match ? (
                  <div className={styles.codeBlock}>
                    <div className={styles.codeHeader}>
                      <span className={styles.codeLanguage}>{match[1]}</span>
                      <button
                        className={styles.copyButton}
                        onClick={() => handleCopyCode(codeString)}
                        title="Copy code"
                      >
                        <span className="codicon codicon-copy" />
                      </button>
                    </div>
                    <SyntaxHighlighter
                      style={vscDarkPlus}
                      language={match[1]}
                      PreTag="div"
                      {...props}
                    >
                      {codeString}
                    </SyntaxHighlighter>
                  </div>
                ) : (
                  <code className={styles.inlineCode} {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};
