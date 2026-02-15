import React from 'react';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { useVSCode } from '../hooks/useVSCode';
import styles from './ActionButtons.module.css';

interface ActionButtonsProps {
  messageId: string;
  hasDiff: boolean;
}

export const ActionButtons: React.FC<ActionButtonsProps> = React.memo(({
  messageId,
  hasDiff
}) => {
  const vscode = useVSCode();
  
  const handleApply = () => {
    vscode.postMessage({
      type: 'applyChanges',
      messageId
    });
  };
  
  const handleRetry = () => {
    vscode.postMessage({
      type: 'retryMessage',
      messageId
    });
  };
  
  return (
    <div className={styles.actions}>
      {hasDiff && (
        <VSCodeButton
          appearance="primary"
          onClick={handleApply}
          aria-label="Apply code changes"
        >
          <span slot="start" className="codicon codicon-check" />
          Apply Changes
        </VSCodeButton>
      )}
      <VSCodeButton
        appearance="secondary"
        onClick={handleRetry}
        aria-label="Retry request"
      >
        <span slot="start" className="codicon codicon-refresh" />
        Retry
      </VSCodeButton>
    </div>
  );
});

ActionButtons.displayName = 'ActionButtons';
