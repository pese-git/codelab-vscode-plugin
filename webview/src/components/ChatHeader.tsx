import React from 'react';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import styles from './ChatHeader.module.css';

interface ChatHeaderProps {
  onNewChat: () => void;
  onBack?: () => void;
  showBackButton?: boolean;
}

export const ChatHeader: React.FC<ChatHeaderProps> = React.memo(({
  onNewChat,
  onBack,
  showBackButton = false
}) => {
  console.log('[ChatHeader] Rendering...', { showBackButton });
  
  return (
    <div className={styles.header}>
      <div className={styles.leftSection}>
        {showBackButton && onBack && (
          <VSCodeButton
            appearance="icon"
            onClick={() => {
              console.log('[ChatHeader] Back button clicked');
              onBack();
            }}
            title="Назад к сессиям"
            aria-label="Back to sessions"
          >
            <span className="codicon codicon-arrow-left" />
          </VSCodeButton>
        )}
        <h2 className={styles.title}>CodeLab</h2>
      </div>
      <div className={styles.actions}>
        <VSCodeButton
          appearance="icon"
          onClick={() => {
            console.log('[ChatHeader] New chat button clicked');
            onNewChat();
          }}
          title="Новый чат"
          aria-label="Start new chat"
        >
          <span className="codicon codicon-add" />
        </VSCodeButton>
        <VSCodeButton
          appearance="icon"
          title="Настройки"
          aria-label="Open settings"
          onClick={() => console.log('[ChatHeader] Settings button clicked')}
        >
          <span className="codicon codicon-settings-gear" />
        </VSCodeButton>
      </div>
    </div>
  );
});

ChatHeader.displayName = 'ChatHeader';
