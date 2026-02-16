import * as vscode from 'vscode';
import { APIClient } from './client';
import { StreamingClient } from './streaming';
import { ContextCollector } from '../context/collector';
import { AuthManager } from './auth';
import { getAPIConfig } from './config';
import { withRetry } from './errors';
import type { MessageRequest } from './schemas';

export class CodeLabAPI {
  private client: APIClient;
  private streamingClient: StreamingClient | null = null;
  private contextCollector: ContextCollector;
  private authManager: AuthManager;
  
  constructor(private context: vscode.ExtensionContext) {
    this.client = new APIClient(context);
    this.contextCollector = new ContextCollector();
    this.authManager = new AuthManager(context);
  }
  
  async sendMessage(content: string, targetAgent?: string): Promise<void> {
    console.log('[CodeLabAPI] sendMessage called with:', { content, targetAgent });
    
    // 1. Создать сессию если нужно
    let sessionId = this.context.globalState.get<string>('currentSessionId');
    console.log('[CodeLabAPI] Current session ID:', sessionId);
    
    if (!sessionId) {
      console.log('[CodeLabAPI] No session ID, creating new session...');
      const session = await withRetry(() => this.client.createSession());
      sessionId = session.id;
      await this.context.globalState.update('currentSessionId', sessionId);
      console.log('[CodeLabAPI] New session created:', sessionId);
    }
    
    // 2. Подключить streaming если еще не подключен
    if (!this.streamingClient) {
      console.log('[CodeLabAPI] Streaming client not connected, connecting...');
      await this.connectStreaming(sessionId);
      console.log('[CodeLabAPI] Streaming client connected');
    }
    
    // 3. Собрать контекст
    console.log('[CodeLabAPI] Collecting project context...');
    const projectContext = await this.contextCollector.collectContext();
    console.log('[CodeLabAPI] Project context collected:', projectContext);
    
    // 4. Отправить сообщение
    const request: MessageRequest = {
      content,
      target_agent: targetAgent,
      context: projectContext
    };
    
    console.log('[CodeLabAPI] Sending message to backend...', request);
    await withRetry(() =>
      this.client.sendMessage(sessionId!, request)
    );
    console.log('[CodeLabAPI] Message sent successfully');
    
    // 5. События будут приходить через streaming
  }
  
  private async connectStreaming(sessionId: string): Promise<void> {
    const token = await this.authManager.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const config = getAPIConfig();
    this.streamingClient = new StreamingClient(
      sessionId,
      token,
      config.baseUrl
    );
    
    // Setup event handlers
    this.setupStreamingHandlers();
    
    // Connect
    await this.streamingClient.connect();
  }
  
  private setupStreamingHandlers(): void {
    if (!this.streamingClient) {return;}
    
    this.streamingClient.on('task_started', (payload) => {
      this.onTaskStarted?.(payload);
    });
    
    this.streamingClient.on('task_progress', (payload) => {
      this.onTaskProgress?.(payload);
    });
    
    this.streamingClient.on('task_completed', (payload) => {
      this.onTaskCompleted?.(payload);
    });
    
    this.streamingClient.on('message_created', (payload) => {
      console.log('[CodeLabAPI] message_created event received:', payload);
      this.onMessageCreated?.(payload);
    });
    
    this.streamingClient.on('error', (payload) => {
      this.onError?.(payload);
    });
    
    this.streamingClient.onConnected = () => {
      vscode.window.showInformationMessage('Connected to CodeLab');
    };
    
    this.streamingClient.onMaxReconnectAttemptsReached = () => {
      vscode.window.showErrorMessage('Failed to connect to CodeLab. Please check your connection.');
    };
  }
  
  // Event callbacks
  onTaskStarted?: (payload: any) => void;
  onTaskProgress?: (payload: any) => void;
  onTaskCompleted?: (payload: any) => void;
  onMessageCreated?: (payload: any) => void;
  onError?: (payload: any) => void;
  
  async getCurrentSessionId(): Promise<string | undefined> {
    return this.context.globalState.get<string>('currentSessionId');
  }
  
  async clearCurrentSessionId(): Promise<void> {
    await this.context.globalState.update('currentSessionId', undefined);
    
    if (this.streamingClient) {
      this.streamingClient.disconnect();
      this.streamingClient = null;
    }
  }
  
  async getMessageHistory(sessionId: string) {
    return await this.client.getMessageHistory(sessionId);
  }
  
  async listSessions() {
    return await withRetry(() => this.client.listSessions());
  }
  
  async switchSession(sessionId: string): Promise<void> {
    await this.context.globalState.update('currentSessionId', sessionId);
    
    // Reconnect streaming to new session
    if (this.streamingClient) {
      this.streamingClient.disconnect();
      this.streamingClient = null;
    }
    
    // Подключаем streaming в фоне, не блокируя переключение сессии
    this.connectStreaming(sessionId).catch(error => {
      console.error('Failed to connect streaming for session:', sessionId, error);
    });
  }
  
  async deleteSession(sessionId: string): Promise<void> {
    await withRetry(() => this.client.deleteSession(sessionId));
    
    // If deleting current session, clear it
    const currentSessionId = await this.getCurrentSessionId();
    if (currentSessionId === sessionId) {
      await this.context.globalState.update('currentSessionId', undefined);
      
      if (this.streamingClient) {
        this.streamingClient.disconnect();
        this.streamingClient = null;
      }
    }
  }
  
  async createNewSession(): Promise<string> {
    const session = await withRetry(() => this.client.createSession());
    await this.context.globalState.update('currentSessionId', session.id);
    
    // Reconnect streaming
    if (this.streamingClient) {
      this.streamingClient.disconnect();
      this.streamingClient = null;
    }
    
    await this.connectStreaming(session.id);
    return session.id;
  }
  
  async listAgents() {
    return await withRetry(() => this.client.listAgents());
  }
  
  dispose(): void {
    this.streamingClient?.disconnect();
    this.contextCollector.clearCache();
  }
}

export * from './schemas';
export * from './errors';
