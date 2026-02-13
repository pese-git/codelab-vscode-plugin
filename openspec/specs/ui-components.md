# UI Components Specification

## Обзор

Спецификация пользовательского интерфейса VS Code плагина CodeLab. UI реализован через WebView в Sidebar с использованием **React 18.3+** для создания интерактивного чат-интерфейса.

## Технологический стек UI

### Core
- **React 18.3+** - UI framework с concurrent features
- **TypeScript 5.9+** - полная типизация
- **Vite 5.x** - современный bundler для WebView

### Styling
- **CSS Modules** - изолированные стили с локальными именами
- **VS Code CSS Variables** - интеграция с темами VS Code

### Content Rendering
- **marked 14.x** - безопасный markdown rendering
- **highlight.js 11.x** - syntax highlighting для code blocks
- **DOMPurify** - санитизация HTML (опционально)

### Performance
- **@tanstack/react-virtual 3.x** - виртуализация для больших списков
- **React.memo** - мемоизация компонентов
- **useMemo/useCallback** - оптимизация хуков

### Development
- **@types/react 18.x** - типы для React
- **@types/react-dom 18.x** - типы для ReactDOM
- **@vitejs/plugin-react 4.x** - Vite plugin для React

## Архитектура UI

```
┌─────────────────────────────────────┐
│     VS Code Activity Bar            │
│  ┌─────┐                            │
│  │ 🤖  │ ← CodeLab Icon             │
│  └─────┘                            │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│     Sidebar WebView (React App)     │
│                                     │
│  ┌───────────────────────────────┐ │
│  │  <ChatHeader />               │ │
│  │  [New Chat] [Settings]        │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │  <MessageList />              │ │
│  │  (Virtual Scrolling)          │ │
│  │                               │ │
│  │  <UserMessage />              │ │
│  │  <AssistantMessage />         │ │
│  │  <ProgressMessage />          │ │
│  │                               │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │  <ChatInput />                │ │
│  │  [📎] [Type message...] [▶]  │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

## Project Structure

```
webview/
├── src/
│   ├── App.tsx                 # Main React app
│   ├── main.tsx               # Entry point
│   ├── vscode.ts              # VS Code API wrapper
│   ├── components/
│   │   ├── ChatHeader.tsx
│   │   ├── MessageList.tsx
│   │   ├── Message/
│   │   │   ├── UserMessage.tsx
│   │   │   ├── AssistantMessage.tsx
│   │   │   ├── ProgressMessage.tsx
│   │   │   └── Message.module.css
│   │   ├── ChatInput.tsx
│   │   ├── CodeBlock.tsx
│   │   └── ActionButtons.tsx
│   ├── hooks/
│   │   ├── useMessages.ts
│   │   ├── useStreaming.ts
│   │   └── useVSCode.ts
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   │   ├── markdown.ts
│   │   └── validation.ts
│   └── styles/
│       ├── global.css
│       └── variables.css
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## WebView Provider

### Registration

```typescript
// src/ui/ChatViewProvider.ts
import * as vscode from 'vscode';
import * as path from 'path';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'codelab.chatView';
  
  private _view?: vscode.WebviewView;
  
  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly api: CodeLabAPI
  ) {}
  
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview')
      ]
    };
    
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    
    // Handle messages from React app
    webviewView.webview.onDidReceiveMessage(
      async (message) => await this._handleMessage(message)
    );
    
    // Setup streaming event handlers
    this.setupStreamingHandlers();
  }
  
  private _getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'index.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'index.css')
    );
    
    const nonce = getNonce();
    
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" 
            content="default-src 'none'; 
                     style-src ${webview.cspSource} 'unsafe-inline'; 
                     script-src 'nonce-${nonce}'; 
                     font-src ${webview.cspSource};
                     img-src ${webview.cspSource} https:;
                     connect-src ${webview.cspSource} https:;">
      <link href="${styleUri}" rel="stylesheet">
      <title>CodeLab Chat</title>
    </head>
    <body>
      <div id="root"></div>
      <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
  }
  
  private async _handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'sendMessage':
        await this.api.sendMessage(message.content);
        break;
      case 'applyChanges':
        await this.applyChanges(message.diff);
        break;
      case 'copyCode':
        await vscode.env.clipboard.writeText(message.code);
        this.postMessage({ type: 'codeCopied' });
        break;
      case 'newChat':
        await this.startNewChat();
        break;
      case 'ready':
        // React app is ready, send initial state
        await this.sendInitialState();
        break;
    }
  }
  
  private setupStreamingHandlers(): void {
    // Forward streaming events to React app
    this.api.onTaskStarted((payload) => {
      this.postMessage({ type: 'taskStarted', payload });
    });
    
    this.api.onTaskProgress((payload) => {
      this.postMessage({ type: 'taskProgress', payload });
    });
    
    this.api.onTaskCompleted((payload) => {
      this.postMessage({ type: 'taskCompleted', payload });
    });
  }
  
  public postMessage(message: any): void {
    this._view?.webview.postMessage(message);
  }
  
  private async sendInitialState(): Promise<void> {
    const sessionId = await this.api.getCurrentSessionId();
    const messages = sessionId 
      ? await this.api.getMessageHistory(sessionId)
      : [];
    
    this.postMessage({
      type: 'initialState',
      payload: {
        sessionId,
        messages: messages.messages
      }
    });
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
```

## React Application

### Main App Component

```typescript
// webview/src/App.tsx
import React, { useEffect, useState } from 'react';
import { ChatHeader } from './components/ChatHeader';
import { MessageList } from './components/MessageList';
import { ChatInput } from './components/ChatInput';
import { useMessages } from './hooks/useMessages';
import { useVSCode } from './hooks/useVSCode';
import type { Message } from './types';
import './styles/global.css';

export const App: React.FC = () => {
  const vscode = useVSCode();
  const { messages, addMessage, updateProgress, isLoading, setIsLoading } = useMessages();
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  useEffect(() => {
    // Notify extension that React app is ready
    vscode.postMessage({ type: 'ready' });
    
    // Listen for messages from extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      switch (message.type) {
        case 'initialState':
          setSessionId(message.payload.sessionId);
          message.payload.messages.forEach((msg: Message) => addMessage(msg));
          break;
          
        case 'taskStarted':
          setIsLoading(true);
          addMessage({
            id: `progress-${message.payload.task_id}`,
            role: 'system',
            content: 'Processing...',
            timestamp: new Date().toISOString(),
            isProgress: true,
            progress: 0
          });
          break;
          
        case 'taskProgress':
          updateProgress(
            `progress-${message.payload.task_id}`,
            message.payload.progress_percent,
            message.payload.message
          );
          break;
          
        case 'taskCompleted':
          setIsLoading(false);
          addMessage({
            id: message.payload.task_id,
            role: 'assistant',
            content: message.payload.result,
            timestamp: message.payload.timestamp,
            agentId: message.payload.agent_id
          });
          break;
          
        case 'codeCopied':
          // Show toast notification
          break;
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [vscode, addMessage, updateProgress, setIsLoading]);
  
  const handleSendMessage = (content: string) => {
    // Add user message to UI immediately
    addMessage({
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    });
    
    // Send to extension
    vscode.postMessage({
      type: 'sendMessage',
      content
    });
    
    setIsLoading(true);
  };
  
  const handleNewChat = () => {
    vscode.postMessage({ type: 'newChat' });
    setSessionId(null);
  };
  
  return (
    <div className="app">
      <ChatHeader onNewChat={handleNewChat} />
      <MessageList messages={messages} />
      <ChatInput 
        onSend={handleSendMessage} 
        disabled={isLoading}
      />
    </div>
  );
};
```

### Types

```typescript
// webview/src/types/index.ts
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  agentId?: string;
  isProgress?: boolean;
  progress?: number;
  diff?: string;
}

export interface VSCodeAPI {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
}
```

### VS Code API Hook

```typescript
// webview/src/hooks/useVSCode.ts
import { useRef } from 'react';
import type { VSCodeAPI } from '../types';

declare global {
  interface Window {
    acquireVsCodeApi(): VSCodeAPI;
  }
}

export function useVSCode(): VSCodeAPI {
  const vscodeRef = useRef<VSCodeAPI>();
  
  if (!vscodeRef.current) {
    vscodeRef.current = window.acquireVsCodeApi();
  }
  
  return vscodeRef.current;
}
```

### Messages Hook

```typescript
// webview/src/hooks/useMessages.ts
import { useState, useCallback } from 'react';
import type { Message } from '../types';

export function useMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const addMessage = useCallback((message: Message) => {
    setMessages(prev => [...prev, message]);
  }, []);
  
  const updateProgress = useCallback((
    messageId: string, 
    progress: number,
    text?: string
  ) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, progress, content: text || msg.content }
        : msg
    ));
  }, []);
  
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);
  
  return {
    messages,
    addMessage,
    updateProgress,
    clearMessages,
    isLoading,
    setIsLoading
  };
}
```

## React Components

### ChatHeader Component

```typescript
// webview/src/components/ChatHeader.tsx
import React from 'react';
import styles from './ChatHeader.module.css';

interface ChatHeaderProps {
  onNewChat: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = React.memo(({ onNewChat }) => {
  return (
    <div className={styles.header}>
      <button 
        className={styles.iconButton}
        onClick={onNewChat}
        title="New Chat"
        aria-label="Start new chat"
      >
        <i className="codicon codicon-add" />
      </button>
      <h2 className={styles.title}>CodeLab</h2>
      <button 
        className={styles.iconButton}
        title="Settings"
        aria-label="Open settings"
      >
        <i className="codicon codicon-settings-gear" />
      </button>
    </div>
  );
});

ChatHeader.displayName = 'ChatHeader';
```

### MessageList Component with Virtual Scrolling

```typescript
// webview/src/components/MessageList.tsx
import React, { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { UserMessage } from './Message/UserMessage';
import { AssistantMessage } from './Message/AssistantMessage';
import { ProgressMessage } from './Message/ProgressMessage';
import type { Message } from '../types';
import styles from './MessageList.module.css';

interface MessageListProps {
  messages: Message[];
}

export const MessageList: React.FC<MessageListProps> = React.memo(({ messages }) => {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5
  });
  
  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (parentRef.current) {
      parentRef.current.scrollTop = parentRef.current.scrollHeight;
    }
  }, [messages.length]);
  
  const renderMessage = (message: Message) => {
    if (message.isProgress) {
      return <ProgressMessage message={message} />;
    }
    
    if (message.role === 'user') {
      return <UserMessage message={message} />;
    }
    
    return <AssistantMessage message={message} />;
  };
  
  return (
    <div className={styles.container} ref={parentRef}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {virtualizer.getVirtualItems().map(virtualItem => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`
            }}
          >
            {renderMessage(messages[virtualItem.index])}
          </div>
        ))}
      </div>
    </div>
  );
});

MessageList.displayName = 'MessageList';
```

### UserMessage Component

```typescript
// webview/src/components/Message/UserMessage.tsx
import React from 'react';
import type { Message } from '../../types';
import styles from './Message.module.css';

interface UserMessageProps {
  message: Message;
}

export const UserMessage: React.FC<UserMessageProps> = React.memo(({ message }) => {
  return (
    <div className={`${styles.message} ${styles.userMessage}`}>
      <div className={styles.avatar}>
        <i className="codicon codicon-account" />
      </div>
      <div className={styles.content}>
        <div className={styles.text}>
          {message.content}
        </div>
        <div className={styles.meta}>
          <span className={styles.time}>
            {formatTime(message.timestamp)}
          </span>
        </div>
      </div>
    </div>
  );
});

UserMessage.displayName = 'UserMessage';

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}
```

### AssistantMessage Component

```typescript
// webview/src/components/Message/AssistantMessage.tsx
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
        <i className="codicon codicon-hubot" />
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
```

### ProgressMessage Component

```typescript
// webview/src/components/Message/ProgressMessage.tsx
import React from 'react';
import type { Message } from '../../types';
import styles from './Message.module.css';

interface ProgressMessageProps {
  message: Message;
}

export const ProgressMessage: React.FC<ProgressMessageProps> = React.memo(({ message }) => {
  const progress = message.progress || 0;
  
  return (
    <div className={`${styles.message} ${styles.progressMessage}`}>
      <div className={styles.avatar}>
        <i className="codicon codicon-loading codicon-modifier-spin" />
      </div>
      <div className={styles.content}>
        <div className={styles.progressInfo}>
          <div className={styles.progressText}>{message.content}</div>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <div className={styles.progressPercent}>{progress}%</div>
        </div>
      </div>
    </div>
  );
});

ProgressMessage.displayName = 'ProgressMessage';
```

### CodeBlock Component

```typescript
// webview/src/components/CodeBlock.tsx
import React, { useState, useMemo } from 'react';
import hljs from 'highlight.js';
import { useVSCode } from '../hooks/useVSCode';
import styles from './CodeBlock.module.css';

interface CodeBlockProps {
  code: string;
  language: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = React.memo(({ code, language }) => {
  const vscode = useVSCode();
  const [copied, setCopied] = useState(false);
  
  const highlightedCode = useMemo(() => {
    try {
      return hljs.highlight(code, { language }).value;
    } catch {
      return hljs.highlightAuto(code).value;
    }
  }, [code, language]);
  
  const handleCopy = () => {
    vscode.postMessage({
      type: 'copyCode',
      code
    });
    
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className={styles.codeBlock}>
      <div className={styles.header}>
        <span className={styles.language}>{language}</span>
        <button 
          className={styles.copyButton}
          onClick={handleCopy}
          aria-label={copied ? 'Code copied' : 'Copy code'}
        >
          <i className={`codicon codicon-${copied ? 'check' : 'copy'}`} />
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className={styles.pre}>
        <code 
          className={`language-${language}`}
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
        />
      </pre>
    </div>
  );
});

CodeBlock.displayName = 'CodeBlock';
```

### ActionButtons Component

```typescript
// webview/src/components/ActionButtons.tsx
import React from 'react';
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
        <button 
          className={styles.applyButton} 
          onClick={handleApply}
          aria-label="Apply code changes"
        >
          <i className="codicon codicon-check" />
          Apply Changes
        </button>
      )}
      <button 
        className={styles.retryButton} 
        onClick={handleRetry}
        aria-label="Retry request"
      >
        <i className="codicon codicon-refresh" />
        Retry
      </button>
    </div>
  );
});

ActionButtons.displayName = 'ActionButtons';
```

### ChatInput Component

```typescript
// webview/src/components/ChatInput.tsx
import React, { useState, useRef, useEffect } from 'react';
import styles from './ChatInput.module.css';

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = React.memo(({ onSend, disabled }) => {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
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
    if (!content || disabled) return;
    
    onSend(content);
    setValue('');
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  return (
    <div className={styles.inputArea}>
      <button 
        className={styles.iconButton}
        title="Attach file"
        disabled={disabled}
        aria-label="Attach file"
      >
        <i className="codicon codicon-paperclip" />
      </button>
      
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        placeholder="Type your message..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
        aria-label="Message input"
      />
      
      <button 
        className={`${styles.iconButton} ${styles.primary}`}
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        title="Send"
        aria-label="Send message"
      >
        <i className="codicon codicon-send" />
      </button>
    </div>
  );
});

ChatInput.displayName = 'ChatInput';
```

## Styling with CSS Modules

```css
/* webview/src/styles/variables.css */
:root {
  /* VS Code theme variables */
  --font-family: var(--vscode-font-family);
  --foreground: var(--vscode-foreground);
  --background: var(--vscode-editor-background);
  --border: var(--vscode-panel-border);
  
  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
  
  /* Sizes */
  --avatar-size: 32px;
  --icon-size: 16px;
  
  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
}
```

```css
/* webview/src/components/Message/Message.module.css */
.message {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.avatar {
  width: var(--avatar-size);
  height: var(--avatar-size);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  flex-shrink: 0;
}

.content {
  flex: 1;
  min-width: 0;
}

.text {
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: 8px;
  background-color: var(--vscode-input-background);
  word-wrap: break-word;
}

.userMessage .text {
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.meta {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-xs);
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.progressBar {
  width: 100%;
  height: 4px;
  background-color: var(--vscode-progressBar-background);
  border-radius: 2px;
  overflow: hidden;
  margin: var(--spacing-sm) 0;
}

.progressFill {
  height: 100%;
  background-color: var(--vscode-progressBar-background);
  transition: width var(--transition-normal);
}
```

## Build Configuration

### Vite Config

```typescript
// webview/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../dist/webview',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'index.js',
        assetFileNames: 'index.css',
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'markdown': ['marked', 'highlight.js']
        }
      }
    },
    minify: 'esbuild',
    target: 'es2020'
  },
  css: {
    modules: {
      localsConvention: 'camelCase',
      generateScopedName: '[name]__[local]___[hash:base64:5]'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

### Package.json

```json
{
  "name": "codelab-webview",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "marked": "^14.0.0",
    "highlight.js": "^11.10.0",
    "@tanstack/react-virtual": "^3.10.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.9.3",
    "vite": "^5.4.0"
  }
}
```

### TypeScript Config

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

## Performance Optimization

### 1. React.memo для компонентов
Все компоненты обернуты в `React.memo` для предотвращения лишних ре-рендеров.

### 2. useMemo для тяжелых вычислений
Markdown parsing и syntax highlighting кэшируются через `useMemo`.

### 3. Virtual Scrolling
Использование `@tanstack/react-virtual` для больших списков сообщений.

### 4. Code Splitting
Vite автоматически разделяет код на chunks (react-vendor, markdown).

### 5. Lazy Loading
```typescript
const SettingsPanel = React.lazy(() => import('./components/SettingsPanel'));
```

## Testing

### Component Tests

```typescript
// webview/src/components/__tests__/ChatInput.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatInput } from '../ChatInput';

describe('ChatInput', () => {
  it('should call onSend when Enter is pressed', () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(onSend).toHaveBeenCalledWith('Hello');
  });
  
  it('should not send empty messages', () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    
    const button = screen.getByTitle('Send');
    fireEvent.click(button);
    
    expect(onSend).not.toHaveBeenCalled();
  });
  
  it('should be disabled when disabled prop is true', () => {
    render(<ChatInput onSend={vi.fn()} disabled />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    expect(input).toBeDisabled();
  });
});
```

## Accessibility

### 1. Keyboard Navigation
- Все интерактивные элементы доступны с клавиатуры
- Tab order логичный и предсказуемый
- Enter для отправки, Shift+Enter для новой строки

### 2. ARIA Labels
- `aria-label` для всех кнопок
- `role="progressbar"` для прогресс-баров
- `aria-valuenow`, `aria-valuemin`, `aria-valuemax` для прогресса

### 3. Semantic HTML
- Правильные HTML элементы (`<button>`, `<textarea>`, `<nav>`)
- Heading hierarchy (`<h2>` для заголовка)

### 4. Focus Management
- Автофокус на input при открытии
- Видимые focus indicators

### 5. High Contrast Support
- Использование VS Code theme variables
- Поддержка всех тем VS Code

## Security

### 1. Content Security Policy
Строгий CSP в HTML template предотвращает XSS атаки.

### 2. Markdown Sanitization
`marked` настроен с безопасными опциями, опционально DOMPurify для дополнительной санитизации.

### 3. No eval()
Полное отсутствие `eval()` и `Function()` конструкторов.

### 4. Input Validation
Валидация всех пользовательских вводов перед отправкой в extension.
