import React, { useEffect, useState, useRef } from 'react';
import { ChatHeader } from './components/ChatHeader';
import { MessageList } from './components/MessageList';
import { ChatInput } from './components/ChatInput';
import { SessionList } from './components/SessionList';
import { useMessages } from './hooks/useMessages';
import { useVSCode } from './hooks/useVSCode';
import type { Message, ChatSession, Agent } from './types';
import './styles/global.css';

export const App: React.FC = () => {
  console.log('[App] Component rendering...');
  
  const vscode = useVSCode();
  console.log('[App] VSCode API acquired:', !!vscode);
  
  const { messages, addMessage, setMessagesDirectly, updateProgress, isLoading, setIsLoading, clearMessages } = useMessages();
  console.log('[App] Messages state:', { count: messages.length, isLoading });
  
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  
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
  const stateRef = useRef({ addMessage, setMessagesDirectly, clearMessages, updateProgress, setIsLoading, setSessionId, setSessions, setAgents, setSelectedAgent, agents, setView, vscode });
  
  // Обновляем ref при каждом рендере (не вызывает ререндер)
  stateRef.current = { addMessage, setMessagesDirectly, clearMessages, updateProgress, setIsLoading, setSessionId, setSessions, setAgents, setSelectedAgent, agents, setView, vscode };
  
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
          
        case 'agentsLoaded':
          console.log('[App] Agents loaded:', message.payload);
          state.setAgents(message.payload.agents || []);
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
          
        case 'agentSwitched':
          console.log('[App] Agent switched:', message.payload);
          console.log('[App] Available agents:', state.agents);
          if (message.payload) {
            const agentId = message.payload.selected_agent_id || message.payload.agent_id;
            console.log('[App] Looking for agent ID:', agentId);
            const agent = state.agents.find((a: Agent) => a.id === agentId);
            console.log('[App] Found agent:', agent, 'for agentId:', agentId);
            if (agent) {
              state.setSelectedAgent(agent);
              state.addMessage({
                id: `agent-switched-${Date.now()}`,
                role: 'system',
                content: `Switched to agent: ${agent.name}`,
                timestamp: new Date().toISOString()
              });
            } else if (agentId) {
              console.warn('[App] Agent not found in list, clearing selection');
              state.setSelectedAgent(null);
            }
          }
          break;

        case 'taskCompleted':
          console.log('[App] Task completed:', message.payload);
          console.log('[App] Task completed - result:', message.payload.result);
          console.log('[App] Task completed - error:', message.payload.error);
          console.log('[App] Task completed - task_id:', message.payload.task_id);
          state.setIsLoading(false);
          
          // Сообщение ассистента придет через messageCreated событие
          // Progress сообщение останется в истории
          console.log('[App] Task completed, waiting for messageCreated event');
          break;

        case 'streamError':
          console.log('[App] Stream error:', message.payload);
          state.setIsLoading(false);

          {
            const payload = message.payload || {};
            const errorText = payload.error || payload.message || 'Unknown stream error';
            const agentName = payload.agent_name || payload.agent_id || 'agent';
            state.addMessage({
              id: `stream-error-${Date.now()}`,
              role: 'system',
              content: `Error from ${agentName}: ${errorText}`,
              timestamp: new Date().toISOString(),
              isError: true
            });
          }
          break;
          
        case 'messageCreated':
          console.log('[App] Message created event received:', message);
          const messageCreatedPayload = message.payload;
          console.log('[App] messageCreated payload:', messageCreatedPayload);
          
          // Добавляем только сообщения от ассистента, так как сообщения пользователя
          // уже добавлены локально для мгновенного отклика UI
          if (messageCreatedPayload && messageCreatedPayload.role === 'assistant') {
            state.setIsLoading(false);
            
            const newMessage = {
              id: messageCreatedPayload.message_id || messageCreatedPayload.id || `msg-${Date.now()}`,
              role: 'assistant' as const,
              content: messageCreatedPayload.content,
              timestamp: messageCreatedPayload.timestamp || new Date().toISOString(),
              agentId: messageCreatedPayload.agent_id
            };
            console.log('[App] Adding assistant message from messageCreated:', newMessage);
            state.addMessage(newMessage);
          } else {
            console.log('[App] messageCreated payload is empty or not assistant role:', messageCreatedPayload);
          }
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
    
    // Request agents list
    vscode.postMessage({ type: 'loadAgents' });
    
    console.log('[App] Adding message event listener');
    window.addEventListener('message', handleMessageRef.current!);
    
    // Cleanup: удаляем обработчик при размонтировании
    return () => {
      console.log('[App] Cleanup: removing message event listener');
      window.removeEventListener('message', handleMessageRef.current!);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const handleSendMessage = (content: string, targetAgent?: string) => {
    console.log('[App] Sending message:', content, 'targetAgent:', targetAgent);
    
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
      content,
      targetAgent
    });
    
    setIsLoading(true);
    // Переключаемся на вид чата при отправке сообщения
    setView('chat');
  };
  
  const handleNewChat = () => {
    if (isCreatingSession) {
      console.log('[App] Ignoring duplicate new chat request');
      return;
    }

    setIsCreatingSession(true);
    console.log('[App] New chat requested');
    vscode.postMessage({ type: 'newChat' });
    clearMessages();
    setSessionId(null);
    setView('sessions');
    window.setTimeout(() => setIsCreatingSession(false), 400);
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
    console.log('[App] About to render ChatHeader, MessageList, ChatInput');
    console.log('[App] Messages to pass to MessageList:', messages);
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
            agents={agents}
            selectedAgent={selectedAgent}
            onAgentChange={setSelectedAgent}
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
            agents={agents}
            selectedAgent={selectedAgent}
            onAgentChange={setSelectedAgent}
          />
        </>
      )}
    </div>
  );
};
