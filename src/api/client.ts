import { z } from 'zod';
import { AuthManager } from './auth';
import { getAPIConfig, type APIConfig } from './config';
import { APIError, NetworkError, ValidationError } from './errors';
import type * as vscode from 'vscode';
import {
  HealthResponseSchema,
  ReadyResponseSchema,
  ProjectResponseSchema,
  ProjectListResponseSchema,
  ChatSessionResponseSchema,
  MessageRequestSchema,
  MessageResponseSchema,
  MessageListResponseSchema,
  SessionListResponseSchema,
  AgentResponseSchema,
  AgentListResponseSchema,
  type HealthResponse,
  type ReadyResponse,
  type ProjectResponse,
  type ProjectListResponse,
  type ChatSessionResponse,
  type MessageRequest,
  type MessageResponse,
  type MessageListResponse,
  type SessionListResponse,
  type AgentResponse,
  type AgentListResponse,
  type AgentConfig
} from './schemas';

export class APIClient {
  private config: APIConfig;
  private authManager: AuthManager;
  
  constructor(context: vscode.ExtensionContext) {
    this.config = getAPIConfig();
    this.authManager = new AuthManager(context);
  }
  
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    schema?: z.ZodSchema<T>
  ): Promise<T> {
    const token = await this.authManager.getToken();
    if (!token) {
      throw new APIError(401, 'UNAUTHORIZED', 'Not authenticated');
    }
    
    const url = `${this.config.baseUrl}${endpoint}`;
    
    const headers = new Headers();
    headers.set('Content-Type', 'application/json; charset=utf-8');
    
    const authHeaders = this.authManager.getAuthHeaders(token);
    Object.entries(authHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });
    
    if (options.headers) {
      Object.entries(options.headers as Record<string, string>).forEach(([key, value]) => {
        headers.set(key, value);
      });
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        let errorMessage = 'Unknown error';
        let errorCode = 'UNKNOWN';
        
        try {
          const contentType = response.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            const error: any = await response.json();
            errorMessage = error.detail || error.message || errorMessage;
            errorCode = error.error_code || error.code || errorCode;
          } else {
            errorMessage = await response.text() || errorMessage;
          }
        } catch {
          // Ignore parsing errors
        }
        
        throw new APIError(response.status, errorCode, errorMessage);
      }
      
      const data = await response.json();
      
      // Validate response with Zod if schema provided
      if (schema) {
        try {
          return schema.parse(data);
        } catch (error) {
          if (error instanceof z.ZodError) {
            console.error('Response validation failed:', {
              endpoint,
              errors: error.errors,
              data
            });
            throw new ValidationError('Response validation failed', error);
          }
          throw error;
        }
      }
      
      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof APIError) {
        throw error;
      }
      
      if ((error as any).name === 'AbortError') {
        throw new NetworkError('Request timeout');
      }
      
      throw new NetworkError('Network request failed', error as Error);
    }
  }
  
  async checkHealth(): Promise<HealthResponse> {
    const response = await fetch(`${this.config.baseUrl}/health`);
    const data = await response.json();
    return HealthResponseSchema.parse(data);
  }

  async checkReady(): Promise<ReadyResponse> {
    const response = await fetch(`${this.config.baseUrl}/ready`);
    const data = await response.json();
    return ReadyResponseSchema.parse(data);
  }

  async createProject(name: string, workspacePath?: string): Promise<ProjectResponse> {
    return await this.request(
      '/my/projects/',
      {
        method: 'POST',
        body: JSON.stringify({
          name,
          workspace_path: workspacePath
        })
      },
      ProjectResponseSchema
    );
  }

  async listProjects(): Promise<ProjectListResponse> {
    return await this.request(
      '/my/projects/',
      { method: 'GET' },
      ProjectListResponseSchema
    );
  }

  async getProject(projectId: string): Promise<ProjectResponse> {
    return await this.request(
      `/my/projects/${projectId}/`,
      { method: 'GET' },
      ProjectResponseSchema
    );
  }

  async updateProject(projectId: string, name?: string, workspacePath?: string): Promise<ProjectResponse> {
    const updates: Record<string, any> = {};
    if (name !== undefined) {
      updates.name = name;
    }
    if (workspacePath !== undefined) {
      updates.workspace_path = workspacePath;
    }

    return await this.request(
      `/my/projects/${projectId}/`,
      {
        method: 'PUT',
        body: JSON.stringify(updates)
      },
      ProjectResponseSchema
    );
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.request(
      `/my/projects/${projectId}/`,
      { method: 'DELETE' }
    );
  }

  async createSession(projectId: string): Promise<ChatSessionResponse> {
    return await this.request(
      `/my/projects/${projectId}/chat/sessions/`,
      { method: 'POST', body: JSON.stringify({}) },
      ChatSessionResponseSchema
    );
  }

  async listSessions(projectId: string): Promise<SessionListResponse> {
    return await this.request(
      `/my/projects/${projectId}/chat/sessions/`,
      { method: 'GET' },
      SessionListResponseSchema
    );
  }

  async deleteSession(projectId: string, sessionId: string): Promise<void> {
    await this.request(
      `/my/projects/${projectId}/chat/sessions/${sessionId}`,
      { method: 'DELETE' }
    );
  }

  async sendMessage(
    projectId: string,
    sessionId: string,
    request: MessageRequest
  ): Promise<MessageResponse> {
    const validatedRequest = MessageRequestSchema.parse(request);
    
    return await this.request(
      `/my/projects/${projectId}/chat/${sessionId}/message/`,
      {
        method: 'POST',
        body: JSON.stringify(validatedRequest)
      },
      MessageResponseSchema
    );
  }

  async getMessageHistory(
    projectId: string,
    sessionId: string
  ): Promise<MessageListResponse> {
    return await this.request(
      `/my/projects/${projectId}/chat/sessions/${sessionId}/messages/`,
      { method: 'GET' },
      MessageListResponseSchema
    );
  }

  async createAgent(projectId: string, config: AgentConfig): Promise<AgentResponse> {
    return await this.request(
      `/my/projects/${projectId}/agents/`,
      {
        method: 'POST',
        body: JSON.stringify(config)
      },
      AgentResponseSchema
    );
  }

  async listAgents(projectId: string): Promise<AgentListResponse> {
    return await this.request(
      `/my/projects/${projectId}/agents/`,
      { method: 'GET' },
      AgentListResponseSchema
    );
  }

  async getAgent(projectId: string, agentId: string): Promise<AgentResponse> {
    return await this.request(
      `/my/projects/${projectId}/agents/${agentId}`,
      { method: 'GET' },
      AgentResponseSchema
    );
  }

  async updateAgent(projectId: string, agentId: string, config: AgentConfig): Promise<AgentResponse> {
    return await this.request(
      `/my/projects/${projectId}/agents/${agentId}`,
      {
        method: 'PUT',
        body: JSON.stringify({ config })
      },
      AgentResponseSchema
    );
  }

  async deleteAgent(projectId: string, agentId: string): Promise<void> {
    await this.request(
      `/my/projects/${projectId}/agents/${agentId}`,
      { method: 'DELETE' }
    );
  }
}
