import React from 'react';
import { useVSCode } from '../hooks/useVSCode';
import styles from './ToolApprovalBlock.module.css';

export interface ToolApprovalProps {
  approvalId: string;
  toolName: string;
  toolParams: Record<string, any>;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  timeoutSeconds: number;
  description?: string;
  onRemove: (approvalId: string) => void;
}

/**
 * ToolApprovalBlock
 * Inline approval dialog для tool execution requests
 * Показывает информацию о инструменте и кнопки для одобрения/отклонения
 */
export const ToolApprovalBlock: React.FC<ToolApprovalProps> = ({
  approvalId,
  toolName,
  toolParams,
  riskLevel,
  timeoutSeconds,
  description,
  onRemove
}) => {
  const vscode = useVSCode();
  const [isLoading, setIsLoading] = React.useState(false);
  const [timeLeft, setTimeLeft] = React.useState(timeoutSeconds);

  // Countdown timer
  React.useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Auto-reject on timeout
          handleReject('Timeout');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [approvalId]);

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      console.log('[ToolApprovalBlock] Approving tool execution:', approvalId);
      vscode.postMessage({
        type: 'approveToolExecution',
        approvalId
      });
      onRemove(approvalId);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async (reason = 'User declined execution') => {
    setIsLoading(true);
    try {
      console.log('[ToolApprovalBlock] Rejecting tool execution:', approvalId);
      vscode.postMessage({
        type: 'rejectToolExecution',
        approvalId,
        reason
      });
      onRemove(approvalId);
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'LOW':
        return '#10b981'; // Green
      case 'MEDIUM':
        return '#f59e0b'; // Orange
      case 'HIGH':
        return '#ef4444'; // Red
      default:
        return '#6b7280'; // Gray
    }
  };

  const formatTime = (seconds: number) => {
    if (seconds >= 60) {
      return `${Math.ceil(seconds / 60)} мин`;
    }
    return `${seconds} сек`;
  };

  return (
    <div className={styles.approvalBlock}>
      <div className={styles.header}>
        <div className={styles.title}>
          🔧 <strong>Запрос одобрения</strong>
        </div>
        <div className={styles.timer}>
          ⏱️ {formatTime(timeLeft)}
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.toolInfo}>
          <div className={styles.toolName}>
            Инструмент: <code>{toolName}</code>
          </div>

          <div className={styles.riskLevel}>
            <span className={styles.riskBadge} style={{ borderColor: getRiskColor(riskLevel) }}>
              {riskLevel === 'LOW' && '⚠️ LOW'}
              {riskLevel === 'MEDIUM' && '⚠️ MEDIUM'}
              {riskLevel === 'HIGH' && '🔴 HIGH'}
            </span>
          </div>

          {description && <div className={styles.description}>{description}</div>}

          <div className={styles.paramsSection}>
            <div className={styles.paramsLabel}>Параметры:</div>
            <pre className={styles.params}>
              {JSON.stringify(toolParams, null, 2)}
            </pre>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            className={`${styles.button} ${styles.approveButton}`}
            onClick={handleApprove}
            disabled={isLoading}
          >
            {isLoading ? '⏳ Обработка...' : '✅ Одобрить'}
          </button>

          <button
            className={`${styles.button} ${styles.rejectButton}`}
            onClick={() => handleReject()}
            disabled={isLoading}
          >
            {isLoading ? '⏳ Обработка...' : '❌ Отклонить'}
          </button>
        </div>
      </div>
    </div>
  );
};
