import { z } from 'zod';
import { AuthManager } from './auth';
import { getAPIConfig, type APIConfig } from './config';
import { APIError, NetworkError, ValidationError } from './errors';
import type * as vscode from 'vscode';
import {
  HealthResponseSchema,
  ChatSessionResponseSchema,
  MessageRequestSchema,
  MessageResponseSchema,
  MessageHistoryResponseSchema,
  SessionListResponseSchema,
  AgentResponseSchema,
  AgentListResponseSchema,
  type HealthResponse,
  type ChatSessionResponse,
  type MessageRequest,
  type MessageResponse,
  type MessageHistoryResponse,
  type SessionListResponse,
  type CreateAgentRequest,
  type AgentResponse,
  type AgentListResponse
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
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.authManager.getAuthHeaders(token),
      ...(options.headers as Record<string, string> || {})
    };
    
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
          // Игнорируем ошибки парсинга
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
    // Health endpoint не требует аутентификации
    const response = await fetch(`${this.config.baseUrl}/health`);
    const data = await response.json();
    return HealthResponseSchema.parse(data);
  }
  
  async createSession(): Promise<ChatSessionResponse> {
    return await this.request(
      '/my/chat/sessions/',
      { method: 'POST' },
      ChatSessionResponseSchema
    );
  }
  
  async listSessions(): Promise<SessionListResponse> {
    return await this.request(
      '/my/chat/sessions/',
      { method: 'GET' },
      SessionListResponseSchema
    );
  }
  
  async deleteSession(sessionId: string): Promise<void> {
    await this.request(
      `/my/chat/sessions/${sessionId}/`,
      { method: 'DELETE' }
    );
  }
  
  async sendMessage(
    sessionId: string,
    request: MessageRequest
  ): Promise<MessageResponse> {
    // Validate request
    const validatedRequest = MessageRequestSchema.parse(request);
    
    return await this.request(
      `/my/chat/${sessionId}/message/`,
      {
        method: 'POST',
        body: JSON.stringify(validatedRequest)
      },
      MessageResponseSchema
    );
  }
  
  async getMessageHistory(
    sessionId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<MessageHistoryResponse> {
    return await this.request(
      `/my/chat/${sessionId}/messages/?limit=${limit}&offset=${offset}`,
      { method: 'GET' },
      MessageHistoryResponseSchema
    );
  }
  
  async createAgent(config: CreateAgentRequest): Promise<AgentResponse> {
    return await this.request(
      '/my/agents/',
      {
        method: 'POST',
        body: JSON.stringify(config)
      },
      AgentResponseSchema
    );
  }
  
  async listAgents(): Promise<AgentListResponse> {
    return await this.request(
      '/my/agents/',
      { method: 'GET' },
      AgentListResponseSchema
    );
  }
  
  async getAgent(agentId: string): Promise<AgentResponse> {
    return await this.request(
      `/my/agents/${agentId}/`,
      { method: 'GET' },
      AgentResponseSchema
    );
  }
  
  async updateAgent(agentId: string, config: CreateAgentRequest): Promise<AgentResponse> {
    return await this.request(
      `/my/agents/${agentId}/`,
      {
        method: 'PUT',
        body: JSON.stringify(config)
      },
      AgentResponseSchema
    );
  }
  
  async deleteAgent(agentId: string): Promise<void> {
    await this.request(
      `/my/agents/${agentId}/`,
      { method: 'DELETE' }
    );
  }
}
