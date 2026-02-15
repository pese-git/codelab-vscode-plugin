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

export interface ChatSession {
  id: string;
  created_at: string;
  message_count?: number;
  last_message?: string;
  last_message_time?: string;
}

export interface VSCodeAPI {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
}

export interface MessageFromExtension {
  type: 'initialState' | 'taskStarted' | 'taskProgress' | 'taskCompleted' | 'codeCopied' | 'sessionsLoaded' | 'sessionSwitched';
  payload?: any;
}

export interface MessageToExtension {
  type: 'ready' | 'sendMessage' | 'applyChanges' | 'copyCode' | 'newChat' | 'retryMessage' | 'loadSessions' | 'switchSession' | 'deleteSession';
  content?: string;
  code?: string;
  messageId?: string;
  diff?: string;
  sessionId?: string;
}
