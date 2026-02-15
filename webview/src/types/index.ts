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

export interface MessageFromExtension {
  type: 'initialState' | 'taskStarted' | 'taskProgress' | 'taskCompleted' | 'codeCopied';
  payload?: any;
}

export interface MessageToExtension {
  type: 'ready' | 'sendMessage' | 'applyChanges' | 'copyCode' | 'newChat' | 'retryMessage';
  content?: string;
  code?: string;
  messageId?: string;
  diff?: string;
}
