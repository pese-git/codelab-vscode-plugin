import React, { useState, useRef, useEffect } from 'react';
import { VSCodeButton, VSCodeTextArea } from '@vscode/webview-ui-toolkit/react';
import { AgentSelector } from './AgentSelector';
import type { Agent } from '../types';
import styles from './ChatInput.module.css';

interface ChatInputProps {
  onSend: (content: string, targetAgent?: string) => void;
  disabled?: boolean;
  placeholder?: string;
  agents?: Agent[];
  selectedAgent?: Agent | null;
  onAgentChange?: (agent: Agent | null) => void;
}

export const ChatInput: React.FC<ChatInputProps> = React.memo(({
  onSend,
  disabled,
  placeholder = 'Type your message...',
  agents = [],
  selectedAgent = null,
  onAgentChange
}) => {
  console.log('[ChatInput] Rendering, disabled:', disabled);
  
  const [value, setValue] = useState('');
  const textareaRef = useRef<any>(null);
  
  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [value]);
  
  const handleSend = () => {
    const content = value.trim();
    console.log('[ChatInput] Send clicked, content:', content, 'disabled:', disabled);
    
    if (!content || disabled) {
      console.log('[ChatInput] Send blocked - empty or disabled');
      return;
    }
    
    console.log('[ChatInput] Sending message:', content, 'targetAgent:', selectedAgent?.id);
    onSend(content, selectedAgent?.id);
    setValue('');
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      console.log('[ChatInput] Enter pressed');
      e.preventDefault();
      handleSend();
    }
  };
  
  const handleInput = (e: Event | React.FormEvent<HTMLElement>) => {
    const target = e.target as HTMLTextAreaElement;
    console.log('[ChatInput] Input changed, length:', target.value.length);
    setValue(target.value);
  };
  
  return (
    <div className={styles.inputContainer}>
      <div className={styles.inputArea}>
        <VSCodeButton
          appearance="icon"
          title="Attach file"
          disabled={disabled}
          aria-label="Attach file"
          onClick={() => console.log('[ChatInput] Attach button clicked')}
        >
          <span className="codicon codicon-paperclip" />
        </VSCodeButton>
        
        <VSCodeTextArea
          ref={textareaRef}
          className={styles.textarea}
          placeholder={placeholder}
          value={value}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          resize="vertical"
          aria-label="Message input"
        />
        
        <VSCodeButton
          appearance="icon"
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          title="Send"
          aria-label="Send message"
        >
          <span className="codicon codicon-send" />
        </VSCodeButton>
      </div>
      
      {/* Agent Selector под полем ввода */}
      <div className={styles.agentSelectorContainer}>
        <AgentSelector
          agents={agents}
          selectedAgent={selectedAgent}
          onSelectAgent={onAgentChange || (() => {})}
          disabled={disabled}
        />
      </div>
    </div>
  );
});

ChatInput.displayName = 'ChatInput';
