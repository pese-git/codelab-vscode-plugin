import React from 'react';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import styles from './ChatHeader.module.css';

interface ChatHeaderProps {
  onNewChat: () => void;
  onToggleSessions?: () => void;
  showSessions?: boolean;
}

export const ChatHeader: React.FC<ChatHeaderProps> = React.memo(({
  onNewChat,
  onToggleSessions,
  showSessions = false
}) => {
  console.log('[ChatHeader] Rendering...', { showSessions });
  
  return (
    <div className={styles.header}>
      <h2 className={styles.title}>CodeLab</h2>
      <div className={styles.actions}>
        {onToggleSessions && (
          <VSCodeButton
            appearance="icon"
            onClick={() => {
              console.log('[ChatHeader] Sessions button clicked');
              onToggleSessions();
            }}
            title={showSessions ? "Hide Sessions" : "Show Sessions"}
            aria-label={showSessions ? "Hide sessions list" : "Show sessions list"}
          >
            <span className={`codicon ${showSessions ? 'codicon-chevron-up' : 'codicon-list-unordered'}`} />
          </VSCodeButton>
        )}
        <VSCodeButton
          appearance="icon"
          onClick={() => {
            console.log('[ChatHeader] New chat button clicked');
            onNewChat();
          }}
          title="New Chat"
          aria-label="Start new chat"
        >
          <span className="codicon codicon-add" />
        </VSCodeButton>
        <VSCodeButton
          appearance="icon"
          title="Settings"
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
