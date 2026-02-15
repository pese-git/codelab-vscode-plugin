import React, { useEffect, useState } from 'react';
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
  
  const { messages, addMessage, updateProgress, isLoading, setIsLoading, clearMessages } = useMessages();
  console.log('[App] Messages state:', { count: messages.length, isLoading });
  
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  
  useEffect(() => {
    console.log('[App] Mount effect running...');
    
    // Notify extension that React app is ready
    console.log('[App] Sending ready message to extension');
    vscode.postMessage({ type: 'ready' });
    
    // Request sessions list
    vscode.postMessage({ type: 'loadSessions' });
    
    // Listen for messages from extension
    const handleMessage = (event: MessageEvent) => {
      console.log('[App] Received message from extension:', event.data);
      const message = event.data;
      
      switch (message.type) {
        case 'initialState':
          console.log('[App] Setting initial state:', message.payload);
          setSessionId(message.payload.sessionId);
          clearMessages();
          message.payload.messages.forEach((msg: Message) => addMessage(msg));
          break;
          
        case 'sessionsLoaded':
          console.log('[App] Sessions loaded:', message.payload);
          setSessions(message.payload.sessions || []);
          break;
          
        case 'sessionSwitched':
          console.log('[App] Session switched:', message.payload);
          setSessionId(message.payload.sessionId);
          clearMessages();
          message.payload.messages.forEach((msg: Message) => addMessage(msg));
          setShowSessions(false);
          break;
          
        case 'taskStarted':
          console.log('[App] Task started:', message.payload);
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
          console.log('[App] Task progress:', message.payload);
          updateProgress(
            `progress-${message.payload.task_id}`,
            message.payload.progress_percent,
            message.payload.message
          );
          break;
          
        case 'taskCompleted':
          console.log('[App] Task completed:', message.payload);
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
          console.log('[App] Code copied notification');
          break;
          
        default:
          console.log('[App] Unknown message type:', message.type);
      }
    };
    
    console.log('[App] Adding message event listener');
    window.addEventListener('message', handleMessage);
    
    return () => {
      console.log('[App] Cleanup: removing message event listener');
      window.removeEventListener('message', handleMessage);
    };
  }, [vscode, addMessage, updateProgress, setIsLoading, clearMessages]);
  
  const handleSendMessage = (content: string) => {
    console.log('[App] Sending message:', content);
    
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
    console.log('[App] New chat requested');
    vscode.postMessage({ type: 'newChat' });
    clearMessages();
    setSessionId(null);
    setShowSessions(false);
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
    }
  };
  
  const toggleSessions = () => {
    setShowSessions(prev => !prev);
    if (!showSessions) {
      // Reload sessions when opening
      vscode.postMessage({ type: 'loadSessions' });
    }
  };
  
  console.log('[App] Rendering UI components...');
  
  return (
    <div className="app">
      <ChatHeader
        onNewChat={handleNewChat}
        onToggleSessions={toggleSessions}
        showSessions={showSessions}
      />
      {showSessions && (
        <SessionList
          sessions={sessions}
          currentSessionId={sessionId}
          onSessionSelect={handleSessionSelect}
          onNewSession={handleNewChat}
          onDeleteSession={handleDeleteSession}
        />
      )}
      <MessageList messages={messages} />
      <ChatInput
        onSend={handleSendMessage}
        disabled={isLoading}
      />
    </div>
  );
};
