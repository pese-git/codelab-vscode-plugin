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
  
  async sendMessage(content: string): Promise<void> {
    // 1. Создать сессию если нужно
    let sessionId = this.context.globalState.get<string>('currentSessionId');
    if (!sessionId) {
      const session = await withRetry(() => this.client.createSession());
      sessionId = session.id;
      await this.context.globalState.update('currentSessionId', sessionId);
    }
    
    // 2. Подключить streaming если еще не подключен
    if (!this.streamingClient) {
      await this.connectStreaming(sessionId);
    }
    
    // 3. Собрать контекст
    const projectContext = await this.contextCollector.collectContext();
    
    // 4. Отправить сообщение
    const request: MessageRequest = {
      content,
      context: projectContext
    };
    
    await withRetry(() => 
      this.client.sendMessage(sessionId!, request)
    );
    
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
  onError?: (payload: any) => void;
  
  async getCurrentSessionId(): Promise<string | undefined> {
    return this.context.globalState.get<string>('currentSessionId');
  }
  
  async getMessageHistory(sessionId: string) {
    return await this.client.getMessageHistory(sessionId);
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
  
  dispose(): void {
    this.streamingClient?.disconnect();
    this.contextCollector.clearCache();
  }
}

export * from './schemas';
export * from './errors';
