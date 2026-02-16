import { useState } from 'react';
import type { ChatSession } from '../types';
import styles from './SessionList.module.css';

interface SessionListProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
}

export function SessionList({
  sessions,
  currentSessionId,
  onSessionSelect,
  onNewSession,
  onDeleteSession
}: SessionListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const filteredSessions = sessions.filter(session => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      session.id.toLowerCase().includes(query) ||
      session.last_message?.toLowerCase().includes(query)
    );
  });

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      
      return date.toLocaleDateString();
    } catch {
      return 'Invalid Date';
    }
  };

  const handleDelete = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (showDeleteConfirm === sessionId) {
      onDeleteSession(sessionId);
      setShowDeleteConfirm(null);
    } else {
      setShowDeleteConfirm(sessionId);
      setTimeout(() => setShowDeleteConfirm(null), 3000);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search sessions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button
          className={styles.newButton}
          onClick={onNewSession}
          title="New Chat"
        >
          <span className={styles.icon}>+</span>
        </button>
      </div>

      <div className={styles.list}>
        {filteredSessions.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>💬</div>
            <div className={styles.emptyText}>
              {searchQuery ? 'Сессии не найдены' : 'Недавние задачи'}
            </div>
            {!searchQuery && (
              <div className={styles.emptyText} style={{ opacity: 0.7, fontSize: '12px' }}>
                Начните новый чат, введя сообщение ниже
              </div>
            )}
          </div>
        ) : (
          filteredSessions.map((session) => (
            <div
              key={session.id}
              className={`${styles.session} ${
                session.id === currentSessionId ? styles.active : ''
              }`}
              onClick={() => onSessionSelect(session.id)}
            >
              <div className={styles.sessionContent}>
                <div className={styles.sessionHeader}>
                  <span className={styles.sessionTitle}>
                    {session.last_message
                      ? session.last_message.substring(0, 40) + (session.last_message.length > 40 ? '...' : '')
                      : 'New Chat'}
                  </span>
                  <button
                    className={styles.deleteButton}
                    onClick={(e) => handleDelete(session.id, e)}
                    title={showDeleteConfirm === session.id ? 'Click again to confirm' : 'Delete session'}
                  >
                    {showDeleteConfirm === session.id ? '✓' : '×'}
                  </button>
                </div>
                <div className={styles.sessionMeta}>
                  <span className={styles.messageCount}>
                    {session.message_count || 0} messages
                  </span>
                  <span className={styles.timestamp}>
                    {formatDate(session.last_message_time || session.created_at)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
