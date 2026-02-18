import * as vscode from 'vscode';
import { APIClient } from './client';
import { StreamingClient } from './streaming';
import { AuthManager } from './auth';
import { getAPIConfig } from './config';
import { withRetry } from './errors';
import type { MessageRequest } from './schemas';

export class CodeLabAPI {
  private client: APIClient;
  private streamingClient: StreamingClient | null = null;
  private authManager: AuthManager;
  
  constructor(private context: vscode.ExtensionContext) {
    this.client = new APIClient(context);
    this.authManager = new AuthManager(context);
  }
  
  async sendMessage(content: string, targetAgent?: string): Promise<void> {
    console.log('[CodeLabAPI] sendMessage called with:', { content, targetAgent });
    
    // 1. Получить или создать project
    let projectId = await this.getOrCreateProject();
    console.log('[CodeLabAPI] Current project ID:', projectId);
    
    // 2. Создать сессию если нужно
    let sessionId = this.context.globalState.get<string>('currentSessionId');
    console.log('[CodeLabAPI] Current session ID:', sessionId);
    
    if (!sessionId) {
      console.log('[CodeLabAPI] No session ID, creating new session...');
      const session = await withRetry(() => this.client.createSession(projectId));
      sessionId = session.id;
      await this.context.globalState.update('currentSessionId', sessionId);
      console.log('[CodeLabAPI] New session created:', sessionId);
    }
    
    // 3. Подключить streaming если еще не подключен
    if (!this.streamingClient) {
      console.log('[CodeLabAPI] Streaming client not connected, connecting...');
      await this.connectStreaming(projectId, sessionId);
      console.log('[CodeLabAPI] Streaming client connected');
    }
    
    // 4. Отправить сообщение
    const request: MessageRequest = {
      content,
      target_agent: targetAgent
    };
    
    console.log('[CodeLabAPI] Sending message to backend...', request);
    await withRetry(() =>
      this.client.sendMessage(projectId, sessionId!, request)
    );
    console.log('[CodeLabAPI] Message sent successfully');
    
    // 5. События будут приходить через streaming
  }
  
  private async getOrCreateProject(): Promise<string> {
    let projectId = this.context.globalState.get<string>('currentProjectId');
    
    if (!projectId) {
      // Try to get first project
      try {
        const projects = await withRetry(() => this.client.listProjects());
        if (projects.projects.length > 0) {
          projectId = projects.projects[0].id;
          await this.context.globalState.update('currentProjectId', projectId);
          return projectId;
        }
      } catch (error) {
        console.error('Failed to list projects:', error);
      }
      
      // Create default project
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      const projectName = workspaceFolder?.name || 'Default Project';
      
      try {
        const project = await withRetry(() => 
          this.client.createProject(projectName, workspaceFolder?.uri.fsPath)
        );
        projectId = project.id;
        await this.context.globalState.update('currentProjectId', projectId);
        return projectId;
      } catch (error) {
        console.error('Failed to create project:', error);
        throw new Error('Could not create project');
      }
    }
    
    return projectId;
  }
  
  private async connectStreaming(projectId: string, sessionId: string): Promise<void> {
    console.log('[CodeLabAPI] connectStreaming called with:', { projectId, sessionId });
    const token = await this.authManager.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const config = getAPIConfig();
    this.streamingClient = new StreamingClient(
      projectId,
      sessionId,
      token,
      config.baseUrl
    );
    
    // Setup event handlers
    console.log('[CodeLabAPI] Setting up streaming handlers before connect...');
    this.setupStreamingHandlers();
    console.log('[CodeLabAPI] Streaming handlers setup complete');
    
    // Connect
    console.log('[CodeLabAPI] Connecting to streaming endpoint...');
    await this.streamingClient.connect();
    console.log('[CodeLabAPI] Streaming connected');
  }
  
  private setupStreamingHandlers(): void {
    if (!this.streamingClient) {return;}
    
    console.log('[CodeLabAPI] Setting up streaming handlers...');
    
    this.streamingClient.on('message_received', (event) => {
      console.log('[CodeLabAPI] message_received event:', event);
      this.onMessageReceived?.(event.payload || event);
    });
    
    this.streamingClient.on('message_created', (event) => {
      console.log('[CodeLabAPI] message_created event:', event);
      const payload = event.payload || event;
      console.log('[CodeLabAPI] message_created payload extracted:', payload);
      this.onMessageCreated?.(payload);
    });
    
    this.streamingClient.on('agent_started', (event) => {
      console.log('[CodeLabAPI] agent_started event:', event);
      this.onAgentStarted?.(event.payload || event);
    });
    
    this.streamingClient.on('agent_status_changed', (event) => {
      console.log('[CodeLabAPI] agent_status_changed event:', event);
      this.onAgentStatusChanged?.(event.payload || event);
    });
    
    this.streamingClient.on('agent_response', (event) => {
      console.log('[CodeLabAPI] agent_response event:', event);
      this.onAgentResponse?.(event.payload || event);
    });
    
    this.streamingClient.on('agent_completed', (event) => {
      console.log('[CodeLabAPI] agent_completed event:', event);
      this.onAgentCompleted?.(event.payload || event);
    });
    
    this.streamingClient.on('orchestration_started', (event) => {
      console.log('[CodeLabAPI] orchestration_started event:', event);
      this.onOrchestrationStarted?.(event.payload || event);
    });
    
    this.streamingClient.on('orchestration_plan_created', (event) => {
      console.log('[CodeLabAPI] orchestration_plan_created event:', event);
      this.onOrchestrationPlanCreated?.(event.payload || event);
    });
    
    this.streamingClient.on('orchestration_completed', (event) => {
      console.log('[CodeLabAPI] orchestration_completed event:', event);
      this.onOrchestrationCompleted?.(event.payload || event);
    });
    
    this.streamingClient.on('direct_agent_call', (event) => {
      console.log('[CodeLabAPI] direct_agent_call event:', event);
      this.onDirectAgentCall?.(event.payload || event);
    });
    
    this.streamingClient.on('task_started', (event) => {
      console.log('[CodeLabAPI] task_started event:', event);
      this.onTaskStarted?.(event.payload || event);
    });
    
    this.streamingClient.on('task_completed', (event) => {
      console.log('[CodeLabAPI] task_completed event:', event);
      this.onTaskCompleted?.(event.payload || event);
    });
    
    console.log('[CodeLabAPI] All handlers registered');
    
    this.streamingClient.onConnected = () => {
      console.log('[CodeLabAPI] Streaming client connected');
      vscode.window.showInformationMessage('Connected to CodeLab');
    };
    
    this.streamingClient.onMaxReconnectAttemptsReached = () => {
      console.log('[CodeLabAPI] Max reconnect attempts reached');
      vscode.window.showErrorMessage('Failed to connect to CodeLab. Please check your connection.');
    };
  }
  
  // Event callbacks
  onMessageReceived?: (payload: any) => void;
  onAgentStarted?: (payload: any) => void;
  onAgentStatusChanged?: (payload: any) => void;
  onAgentResponse?: (payload: any) => void;
  onAgentCompleted?: (payload: any) => void;
  onOrchestrationStarted?: (payload: any) => void;
  onOrchestrationPlanCreated?: (payload: any) => void;
  onOrchestrationCompleted?: (payload: any) => void;
  onMessageCreated?: (payload: any) => void;
  onDirectAgentCall?: (payload: any) => void;
  onTaskStarted?: (payload: any) => void;
  onTaskCompleted?: (payload: any) => void;
  
  async getCurrentProjectId(): Promise<string | undefined> {
    return this.context.globalState.get<string>('currentProjectId');
  }
  
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
    const projectId = await this.getOrCreateProject();
    return await this.client.getMessageHistory(projectId, sessionId);
  }
  
  async listSessions() {
    const projectId = await this.getOrCreateProject();
    return await withRetry(() => this.client.listSessions(projectId));
  }
  
  async switchSession(sessionId: string): Promise<void> {
    await this.context.globalState.update('currentSessionId', sessionId);
    
    // Reconnect streaming to new session
    if (this.streamingClient) {
      this.streamingClient.disconnect();
      this.streamingClient = null;
    }
    
    // Подключаем streaming в фоне, не блокируя переключение сессии
    const projectId = await this.getOrCreateProject();
    this.connectStreaming(projectId, sessionId).catch(error => {
      console.error('Failed to connect streaming for session:', sessionId, error);
    });
  }
  
  async deleteSession(sessionId: string): Promise<void> {
    const projectId = await this.getOrCreateProject();
    await withRetry(() => this.client.deleteSession(projectId, sessionId));
    
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
    const projectId = await this.getOrCreateProject();
    const session = await withRetry(() => this.client.createSession(projectId));
    await this.context.globalState.update('currentSessionId', session.id);
    
    // Reconnect streaming
    if (this.streamingClient) {
      this.streamingClient.disconnect();
      this.streamingClient = null;
    }
    
    await this.connectStreaming(projectId, session.id);
    return session.id;
  }
  
  async listAgents() {
    const projectId = await this.getOrCreateProject();
    return await withRetry(() => this.client.listAgents(projectId));
  }
  
  dispose(): void {
    this.streamingClient?.disconnect();
  }
}

export * from './schemas';
export * from './errors';
