import React, { useEffect, useState, useRef } from 'react';
import { ChatHeader } from './components/ChatHeader';
import { MessageList } from './components/MessageList';
import { ChatInput } from './components/ChatInput';
import { SessionList } from './components/SessionList';
import { useMessages } from './hooks/useMessages';
import { useVSCode } from './hooks/useVSCode';
import type { Message, ChatSession } from './types';
import './styles/global.css';

export const App: React.FC = () => {
  console.log('[App] Component rendering...');
  
  const vscode = useVSCode();
  console.log('[App] VSCode API acquired:', !!vscode);
  
  const { messages, addMessage, setMessagesDirectly, updateProgress, isLoading, setIsLoading, clearMessages } = useMessages();
  console.log('[App] Messages state:', { count: messages.length, isLoading });
  
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  // Показываем список сессий, когда нет активной сессии или нет сообщений
  const [view, setView] = useState<'sessions' | 'chat'>(() => {
    // Пытаемся восстановить view из sessionStorage
    const saved = sessionStorage.getItem('codelab-view');
    return (saved === 'chat' || saved === 'sessions') ? saved : 'sessions';
  });
  
  // Сохраняем view в sessionStorage при изменении
  useEffect(() => {
    sessionStorage.setItem('codelab-view', view);
    console.log('[App] View saved to sessionStorage:', view);
  }, [view]);
  
  // Используем ref для хранения актуальных значений без пересоздания обработчика
  const stateRef = useRef({ addMessage, setMessagesDirectly, clearMessages, updateProgress, setIsLoading, setSessionId, setSessions, setView });
  
  // Обновляем ref при каждом рендере (не вызывает ререндер)
  stateRef.current = { addMessage, setMessagesDirectly, clearMessages, updateProgress, setIsLoading, setSessionId, setSessions, setView };
  
  // Создаем обработчик один раз при первом рендере
  const handleMessageRef = useRef<((event: MessageEvent) => void) | null>(null);
  
  if (!handleMessageRef.current) {
    handleMessageRef.current = (event: MessageEvent) => {
      console.log('[App] Received message from extension:', event.data);
      const message = event.data;
      const state = stateRef.current;
      
      switch (message.type) {
        case 'initialState':
          console.log('[App] Setting initial state:', message.payload);
          // Сохраняем sessionId, но не переключаемся автоматически
          state.setSessionId(message.payload.sessionId || null);
          state.clearMessages();
          // Загружаем сообщения в фоне, но остаемся на экране списка сессий
          if (message.payload.messages && message.payload.messages.length > 0) {
            message.payload.messages.forEach((msg: Message) => state.addMessage(msg));
          }
          // Всегда показываем список сессий при старте
          state.setView('sessions');
          break;
          
        case 'sessionsLoaded':
          console.log('[App] Sessions loaded:', message.payload);
          state.setSessions(message.payload.sessions || []);
          break;
          
        case 'sessionSwitched':
          console.log('[App] Session switched:', message.payload);
          // Обновляем все состояния одновременно для минимизации ререндеров
          state.setSessionId(message.payload.sessionId);
          if (message.payload.messages && Array.isArray(message.payload.messages)) {
            console.log('[App] Loading messages:', message.payload.messages.length);
            // Загружаем все сообщения одним батчем вместо forEach
            state.setMessagesDirectly(message.payload.messages);
          } else {
            console.log('[App] No messages to load');
            state.setMessagesDirectly([]);
          }
          state.setView('chat');
          console.log('[App] Switched to chat view');
          break;
          
        case 'taskStarted':
          console.log('[App] Task started:', message.payload);
          state.setIsLoading(true);
          state.addMessage({
            id: `progress-${message.payload.task_id}`,
            role: 'system',
            content: 'Processing...',
            timestamp: new Date().toISOString(),
            isProgress: true,
            progress: 0
          });
          break;
          
        case 'taskProgress':
          console.log('[App] Task progress:', message.payload);
          state.updateProgress(
            `progress-${message.payload.task_id}`,
            message.payload.progress_percent,
            message.payload.message
          );
          break;
          
        case 'taskCompleted':
          console.log('[App] Task completed:', message.payload);
          state.setIsLoading(false);
          state.addMessage({
            id: message.payload.task_id,
            role: 'assistant',
            content: message.payload.result,
            timestamp: message.payload.timestamp,
            agentId: message.payload.agent_id
          });
          break;
          
        case 'codeCopied':
          console.log('[App] Code copied notification');
          break;
          
        default:
          console.log('[App] Unknown message type:', message.type);
      }
    };
  }
  
  useEffect(() => {
    console.log('[App] Mount effect running...');
    
    // Notify extension that React app is ready
    console.log('[App] Sending ready message to extension');
    vscode.postMessage({ type: 'ready' });
    
    // Request sessions list
    vscode.postMessage({ type: 'loadSessions' });
    
    console.log('[App] Adding message event listener');
    window.addEventListener('message', handleMessageRef.current!);
    
    // НЕ удаляем обработчик при cleanup, так как он должен жить весь lifecycle приложения
    // return () => {
    //   console.log('[App] Cleanup: removing message event listener');
    //   window.removeEventListener('message', handleMessageRef.current!);
    // };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const handleSendMessage = (content: string) => {
    console.log('[App] Sending message:', content);
    
    // Если нет активной сессии, создаём новую
    if (!sessionId) {
      vscode.postMessage({ type: 'newChat' });
    }
    
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
    // Переключаемся на вид чата при отправке сообщения
    setView('chat');
  };
  
  const handleNewChat = () => {
    console.log('[App] New chat requested');
    vscode.postMessage({ type: 'newChat' });
    clearMessages();
    setSessionId(null);
    setView('sessions');
  };
  
  const handleSessionSelect = (selectedSessionId: string) => {
    console.log('[App] Session selected:', selectedSessionId);
    vscode.postMessage({
      type: 'switchSession',
      sessionId: selectedSessionId
    });
  };
  
  const handleDeleteSession = (sessionIdToDelete: string) => {
    console.log('[App] Delete session:', sessionIdToDelete);
    vscode.postMessage({
      type: 'deleteSession',
      sessionId: sessionIdToDelete
    });
    // Remove from local state
    setSessions(prev => prev.filter(s => s.id !== sessionIdToDelete));
    // If deleting current session, clear messages
    if (sessionIdToDelete === sessionId) {
      clearMessages();
      setSessionId(null);
      setView('sessions');
    }
  };
  
  const handleBackToSessions = () => {
    setView('sessions');
  };
  
  console.log('[App] Rendering UI components...', { view, sessionId, messagesCount: messages.length });
  
  if (view === 'sessions') {
    console.log('[App] Rendering sessions view');
  } else {
    console.log('[App] Rendering chat view with messages:', messages);
  }
  
  return (
    <div className="app">
      {view === 'sessions' ? (
        // Экран списка сессий с инпутом внизу (как в Roo Code)
        <>
          <ChatHeader
            onNewChat={handleNewChat}
            showBackButton={false}
          />
          <SessionList
            sessions={sessions}
            currentSessionId={sessionId}
            onSessionSelect={handleSessionSelect}
            onNewSession={handleNewChat}
            onDeleteSession={handleDeleteSession}
          />
          <ChatInput
            onSend={handleSendMessage}
            disabled={isLoading}
            placeholder="Начните новый чат или выберите сессию выше..."
          />
        </>
      ) : (
        // Экран чата
        <>
          <ChatHeader
            onNewChat={handleNewChat}
            onBack={handleBackToSessions}
            showBackButton={true}
          />
          <MessageList messages={messages} />
          <ChatInput
            onSend={handleSendMessage}
            disabled={isLoading}
          />
        </>
      )}
    </div>
  );
};
