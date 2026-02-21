import * as vscode from 'vscode';
import { APIClient } from './client';
import { StreamingClient } from './streaming';
import { AuthManager } from './auth';
import { getAPIConfig } from './config';
import { withRetry, APIError } from './errors';
import type { MessageRequest } from './schemas';
import { t } from '../i18n/messages';

export class CodeLabAPI {
  private client: APIClient;
  private streamingClient: StreamingClient | null = null;
  private authManager: AuthManager;
  private activeStreamKey: string | null = null;
  private streamingConnectPromise: Promise<void> | null = null;
  private connectingStreamKey: string | null = null;
  
  constructor(private context: vscode.ExtensionContext) {
    this.client = new APIClient(context);
    this.authManager = new AuthManager(context);
    this.setupWorkspaceListener();
  }
  
  private setupWorkspaceListener(): void {
    // Check for workspace changes on first use
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        console.log('[CodeLabAPI] Workspace folders changed, clearing cached project ID');
        this.context.globalState.update('currentProjectId', undefined);
        this.context.globalState.update('currentSessionId', undefined);
      })
    );
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
    await this.connectStreaming(projectId, sessionId);
    
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
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const hasWorkspace = !!workspaceFolder;
    const currentWorkspaceName = workspaceFolder?.name || 'Default Project';
    const currentWorkspacePath = workspaceFolder?.uri.fsPath;
    
    let projectId = this.context.globalState.get<string>('currentProjectId');
    const savedProjectName = this.context.globalState.get<string>('currentProjectName');
    const wasUsingDefaultProject = this.context.globalState.get<boolean>('usingDefaultProject');
    
    console.log('[CodeLabAPI] Workspace check:', {
      hasWorkspace,
      currentWorkspaceName,
      savedProjectName,
      projectId,
      wasUsingDefaultProject
    });
    
    // If workspace changed, clear cached project and create new one
    if (projectId && savedProjectName && savedProjectName !== currentWorkspaceName) {
      console.log('[CodeLabAPI] Workspace changed from', savedProjectName, 'to', currentWorkspaceName);
      console.log('[CodeLabAPI] Clearing cached project and creating new one');
      await this.context.globalState.update('currentProjectId', undefined);
      await this.context.globalState.update('currentSessionId', undefined);
      await this.context.globalState.update('currentProjectName', undefined);
      await this.context.globalState.update('usingDefaultProject', undefined);
      projectId = undefined;
    }
    
    // If workspace was added after using default project, clear default project flag
    if (hasWorkspace && wasUsingDefaultProject) {
      console.log('[CodeLabAPI] Workspace was opened, switching from default project');
      await this.context.globalState.update('currentProjectId', undefined);
      await this.context.globalState.update('currentSessionId', undefined);
      await this.context.globalState.update('currentProjectName', undefined);
      await this.context.globalState.update('usingDefaultProject', undefined);
      projectId = undefined;
    }
    
    // Check if cached project still exists
    if (projectId) {
      try {
        console.log('[CodeLabAPI] Checking if cached project exists:', projectId);
        // Try to list sessions to verify project exists
        await withRetry(() => this.client.listSessions(projectId!));
        console.log('[CodeLabAPI] Cached project still exists');
        return projectId;
      } catch (error: any) {
        // If project not found (404), clear cache and create new one
        if (error instanceof APIError && error.status === 404) {
          console.log('[CodeLabAPI] Cached project not found (404), clearing cache and creating new one');
          await this.context.globalState.update('currentProjectId', undefined);
          await this.context.globalState.update('currentSessionId', undefined);
          await this.context.globalState.update('currentProjectName', undefined);
          projectId = undefined;
        } else {
          // Other errors, log and return cached projectId
          console.warn('[CodeLabAPI] Error checking project, using cached ID anyway:', error);
          return projectId;
        }
      }
    }
    
    if (!projectId) {
      // Create default project
      try {
        const isDefaultProject = !hasWorkspace;
        console.log('[CodeLabAPI] Creating new project:', {
          currentWorkspaceName,
          currentWorkspacePath,
          isDefaultProject
        });
        const project = await withRetry(() =>
          this.client.createProject(currentWorkspaceName, currentWorkspacePath)
        );
        projectId = project.id;
        await this.context.globalState.update('currentProjectId', projectId);
        await this.context.globalState.update('currentProjectName', currentWorkspaceName);
        await this.context.globalState.update('usingDefaultProject', isDefaultProject);
        console.log('[CodeLabAPI] New project created:', {
          projectId,
          name: currentWorkspaceName,
          isDefaultProject
        });
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
    const streamKey = `${projectId}:${sessionId}`;

    if (this.activeStreamKey === streamKey && this.streamingClient?.getConnectionState()) {
      return;
    }

    if (this.streamingConnectPromise && this.connectingStreamKey === streamKey) {
      await this.streamingConnectPromise;
      return;
    }

    if (this.streamingClient) {
      this.streamingClient.disconnect();
      this.streamingClient = null;
      this.activeStreamKey = null;
    }

    const token = await this.authManager.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const config = getAPIConfig();
    const streamingClient = new StreamingClient(
      projectId,
      sessionId,
      token,
      config.baseUrl
    );

    this.streamingClient = streamingClient;
    this.connectingStreamKey = streamKey;

    console.log('[CodeLabAPI] Setting up streaming handlers before connect...');
    this.setupStreamingHandlers(streamingClient);
    console.log('[CodeLabAPI] Streaming handlers setup complete');

    const connectPromise = (async () => {
      console.log('[CodeLabAPI] Connecting to streaming endpoint...');
      await streamingClient.connect();

      // Ignore stale connection completion
      if (this.streamingClient !== streamingClient) {
        return;
      }

      this.activeStreamKey = streamKey;
      console.log('[CodeLabAPI] Streaming connected');
    })();

    this.streamingConnectPromise = connectPromise;

    try {
      await connectPromise;
    } finally {
      if (this.streamingConnectPromise === connectPromise) {
        this.streamingConnectPromise = null;
      }
      if (this.connectingStreamKey === streamKey) {
        this.connectingStreamKey = null;
      }
    }
  }
  
  private setupStreamingHandlers(streamingClient: StreamingClient): void {
    
    console.log('[CodeLabAPI] Setting up streaming handlers...');
    
    streamingClient.on('message_received', (event) => {
      console.log('[CodeLabAPI] message_received event:', event);
      this.onMessageReceived?.(event.payload || event);
    });
    
    streamingClient.on('message_created', (event) => {
      console.log('[CodeLabAPI] message_created event:', event);
      const payload = event.payload || event;
      console.log('[CodeLabAPI] message_created payload extracted:', payload);
      this.onMessageCreated?.(payload);
    });
    
    streamingClient.on('agent_started', (event) => {
      console.log('[CodeLabAPI] agent_started event:', event);
      this.onAgentStarted?.(event.payload || event);
    });
    
    streamingClient.on('agent_status_changed', (event) => {
      console.log('[CodeLabAPI] agent_status_changed event:', event);
      this.onAgentStatusChanged?.(event.payload || event);
    });
    
    streamingClient.on('agent_response', (event) => {
      console.log('[CodeLabAPI] agent_response event:', event);
      this.onAgentResponse?.(event.payload || event);
    });
    
    streamingClient.on('agent_completed', (event) => {
      console.log('[CodeLabAPI] agent_completed event:', event);
      this.onAgentCompleted?.(event.payload || event);
    });
    
    streamingClient.on('orchestration_started', (event) => {
      console.log('[CodeLabAPI] orchestration_started event:', event);
      this.onOrchestrationStarted?.(event.payload || event);
    });
    
    streamingClient.on('orchestration_plan_created', (event) => {
      console.log('[CodeLabAPI] orchestration_plan_created event:', event);
      this.onOrchestrationPlanCreated?.(event.payload || event);
    });
    
    streamingClient.on('orchestration_completed', (event) => {
      console.log('[CodeLabAPI] orchestration_completed event:', event);
      this.onOrchestrationCompleted?.(event.payload || event);
    });
    
    streamingClient.on('direct_agent_call', (event) => {
      console.log('[CodeLabAPI] direct_agent_call event:', event);
      this.onDirectAgentCall?.(event.payload || event);
    });
    
    streamingClient.on('task_started', (event) => {
      console.log('[CodeLabAPI] task_started event:', event);
      this.onTaskStarted?.(event.payload || event);
    });
    
    streamingClient.on('task_progress', (event) => {
      console.log('[CodeLabAPI] task_progress event:', event);
      this.onTaskProgress?.(event.payload || event);
    });

    streamingClient.on('task_completed', (event) => {
      console.log('[CodeLabAPI] task_completed event:', event);
      this.onTaskCompleted?.(event.payload || event);
    });

    // Tool events
    streamingClient.on('tool_approval_request', (event) => {
      console.log('[CodeLabAPI] tool_approval_request event:', event);
      this.onToolApprovalRequest?.(event.payload || event);
    });

    streamingClient.on('tool_execution_signal', (event) => {
      console.log('[CodeLabAPI] tool_execution_signal event:', event);
      this.onToolExecutionSignal?.(event.payload || event);
    });

    streamingClient.on('tool_result_ack', (event) => {
      console.log('[CodeLabAPI] tool_result_ack event:', event);
      this.onToolResultAck?.(event.payload || event);
    });

    streamingClient.on('error', (event) => {
      console.log('[CodeLabAPI] stream error event:', event);
      this.onStreamError?.(event.payload || event);
    });
    
    console.log('[CodeLabAPI] All handlers registered');
    
    streamingClient.onConnected = () => {
      console.log('[CodeLabAPI] Streaming client connected');
      vscode.window.showInformationMessage(t('info.connected'));
    };
    
    streamingClient.onMaxReconnectAttemptsReached = () => {
      console.log('[CodeLabAPI] Max reconnect attempts reached');
      vscode.window.showErrorMessage(t('errors.connectionFailed'));
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
  onTaskProgress?: (payload: any) => void;
  onTaskCompleted?: (payload: any) => void;
  
  // Tool events
  onToolApprovalRequest?: (payload: any) => void;
  onToolExecutionSignal?: (payload: any) => void;
  onToolResultAck?: (payload: any) => void;
  
  onStreamError?: (payload: any) => void;
  
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
      this.activeStreamKey = null;
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
    const projectId = await this.getOrCreateProject();
    const requestedKey = `${projectId}:${sessionId}`;

    if (this.activeStreamKey === requestedKey && this.streamingClient?.getConnectionState()) {
      await this.context.globalState.update('currentSessionId', sessionId);
      return;
    }

    await this.context.globalState.update('currentSessionId', sessionId);

    await this.connectStreaming(projectId, sessionId);
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
        this.activeStreamKey = null;
      }
    }
  }
  
  async createNewSession(): Promise<string> {
    const projectId = await this.getOrCreateProject();
    const session = await withRetry(() => this.client.createSession(projectId));
    await this.context.globalState.update('currentSessionId', session.id);
    
    await this.connectStreaming(projectId, session.id);
    return session.id;
  }
  
  async listAgents() {
    const projectId = await this.getOrCreateProject();
    return await withRetry(() => this.client.listAgents(projectId));
  }

  // ==================== Tool Methods ====================

  async approveToolExecution(approvalId: string): Promise<void> {
    const projectId = await this.getOrCreateProject();
    console.log('[CodeLabAPI] Approving tool execution:', approvalId);
    await withRetry(() => this.client.approveToolExecution(projectId, approvalId));
  }

  async rejectToolExecution(approvalId: string, reason?: string): Promise<void> {
    const projectId = await this.getOrCreateProject();
    console.log('[CodeLabAPI] Rejecting tool execution:', approvalId);
    await withRetry(() => this.client.rejectToolExecution(projectId, approvalId, reason));
  }

  async submitToolResult(
    toolId: string,
    result: {
      status: 'completed' | 'failed';
      result?: {
        success: boolean;
        stdout?: string;
        stderr?: string;
        exit_code?: number;
        output?: string;
        error?: string;
      };
      error?: string;
    }
  ): Promise<void> {
    const projectId = await this.getOrCreateProject();
    console.log('[CodeLabAPI] Submitting tool result:', toolId, result);
    await withRetry(() => this.client.submitToolResult(projectId, toolId, result));
  }
  
  dispose(): void {
    this.streamingClient?.disconnect();
    this.streamingClient = null;
    this.activeStreamKey = null;
    this.streamingConnectPromise = null;
    this.connectingStreamKey = null;
  }
}

export * from './schemas';
export * from './errors';
