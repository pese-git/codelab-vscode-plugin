import React from 'react';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import styles from './ChatHeader.module.css';

interface ChatHeaderProps {
  onNewChat: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = React.memo(({ onNewChat }) => {
  console.log('[ChatHeader] Rendering...');
  
  return (
    <div className={styles.header}>
      <h2 className={styles.title}>CodeLab</h2>
      <div className={styles.actions}>
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
