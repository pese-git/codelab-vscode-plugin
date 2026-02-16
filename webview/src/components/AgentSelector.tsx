import React, { useState, useRef, useEffect } from 'react';
import type { Agent } from '../types';
import styles from './AgentSelector.module.css';

interface AgentSelectorProps {
  agents: Agent[];
  selectedAgent: Agent | null;
  onSelectAgent: (agent: Agent | null) => void;
  disabled?: boolean;
}

export const AgentSelector: React.FC<AgentSelectorProps> = ({
  agents,
  selectedAgent,
  onSelectAgent,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Закрываем dropdown при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleSelectAgent = (agent: Agent | null) => {
    onSelectAgent(agent);
    setIsOpen(false);
  };

  const getAgentIcon = (agent: Agent | null) => {
    if (!agent) return '🤖';
    
    // Если есть явная иконка, используем её
    if (agent.icon) return agent.icon;
    
    // Определяем тип из имени агента (CodeAssistant -> code, DataAnalyst -> data)
    const name = agent.name.toLowerCase();
    
    // Иконки по типу агента
    const iconMap: Record<string, string> = {
      'code': '💻',
      'data': '📊',
      'document': '📝',
      'architect': '🏗️',
      'ask': '❓',
      'debug': '🪲',
      'orchestrator': '🪃',
      'default': '🤖'
    };
    
    // Пытаемся найти подходящую иконку по имени
    for (const [key, icon] of Object.entries(iconMap)) {
      if (name.includes(key)) {
        return icon;
      }
    }
    
    return iconMap['default'];
  };

  const getAgentDescription = (agent: Agent) => {
    // Если есть явное описание, используем его
    if (agent.description) return agent.description;
    
    // Иначе берем из config.system_prompt (первые 100 символов)
    if (agent.config?.system_prompt) {
      const prompt = agent.config.system_prompt as string;
      return prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt;
    }
    
    return undefined;
  };

  const displayAgent = selectedAgent || { id: 'auto', name: 'Auto', status: 'auto', description: 'Автоматический выбор агента' };

  return (
    <div className={styles.agentSelector} ref={dropdownRef}>
      <button
        className={`${styles.selectorButton} ${disabled ? styles.disabled : ''}`}
        onClick={handleToggle}
        disabled={disabled}
        aria-label="Выбрать агента"
        aria-expanded={isOpen}
      >
        <span className={styles.agentIcon}>{getAgentIcon(selectedAgent)}</span>
        <span className={styles.agentName}>{displayAgent.name}</span>
        <span className={`${styles.arrow} ${isOpen ? styles.arrowUp : ''}`}>
          <span className="codicon codicon-chevron-down" />
        </span>
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            Выберите агента
          </div>
          
          {/* Опция "Auto" */}
          <button
            className={`${styles.agentOption} ${!selectedAgent ? styles.selected : ''}`}
            onClick={() => handleSelectAgent(null)}
          >
            <span className={styles.agentIcon}>🤖</span>
            <div className={styles.agentInfo}>
              <div className={styles.agentOptionName}>Auto</div>
              <div className={styles.agentDescription}>Автоматический выбор агента</div>
            </div>
            {!selectedAgent && (
              <span className={styles.checkmark}>
                <span className="codicon codicon-check" />
              </span>
            )}
          </button>

          <div className={styles.divider} />

          {/* Список агентов */}
          {agents.map((agent) => {
            const description = getAgentDescription(agent);
            return (
              <button
                key={agent.id}
                className={`${styles.agentOption} ${selectedAgent?.id === agent.id ? styles.selected : ''}`}
                onClick={() => handleSelectAgent(agent)}
              >
                <span className={styles.agentIcon}>{getAgentIcon(agent)}</span>
                <div className={styles.agentInfo}>
                  <div className={styles.agentOptionName}>{agent.name}</div>
                  {description && (
                    <div className={styles.agentDescription}>{description}</div>
                  )}
                </div>
                {selectedAgent?.id === agent.id && (
                  <span className={styles.checkmark}>
                    <span className="codicon codicon-check" />
                  </span>
                )}
              </button>
            );
          })}

          {agents.length === 0 && (
            <div className={styles.emptyState}>
              Нет доступных агентов
            </div>
          )}
        </div>
      )}
    </div>
  );
};
