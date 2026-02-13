# API Integration Specification

## Обзор

Спецификация интеграции VS Code плагина с backend API сервисом CodeLab. Документация описывает современные подходы к работе с REST API и Streaming Fetch API для real-time коммуникации.

## Ключевые принципы

1. **Thin Client** - плагин не содержит бизнес-логики
2. **REST для команд** - одиночные запросы через REST API
3. **Streaming Fetch для событий** - real-time обновления через ReadableStream
4. **Безопасность** - JWT токены в SecretStorage
5. **Надежность** - retry, reconnect, graceful degradation
6. **Type Safety** - Zod для валидации, TypeScript strict mode

## Технологический стек

### Core
- **Fetch API** - нативный HTTP client (Node.js 18+)
- **AbortController** - управление запросами и отмена
- **ReadableStream** - streaming через Fetch API
- **TextDecoder** - декодирование stream chunks

### Type Safety & Validation
- **Zod** - runtime валидация с type inference
- **TypeScript 5.9+** - strict mode, typed errors

### Error Handling
- **Typed Errors** - кастомные error классы
- **Exponential Backoff** - retry стратегия
- **Circuit Breaker** - защита от перегрузки

## API Client Architecture

```typescript
interface IAPIClient {
  // Health
  checkHealth(): Promise<HealthResponse>;
  
  // Agents
  createAgent(config: CreateAgentRequest): Promise<AgentResponse>;
  listAgents(): Promise<AgentListResponse>;
  getAgent(agentId: string): Promise<AgentResponse>;
  updateAgent(agentId: string, config: CreateAgentRequest): Promise<AgentResponse>;
  deleteAgent(agentId: string): Promise<void>;
  
  // Chat Sessions
  createSession(): Promise<ChatSessionResponse>;
  listSessions(): Promise<SessionListResponse>;
  deleteSession(sessionId: string): Promise<void>;
  
  // Messages
  sendMessage(sessionId: string, request: MessageRequest): Promise<MessageResponse>;
  getMessageHistory(sessionId: string, limit?: number, offset?: number): Promise<MessageHistoryResponse>;
  
  // Streaming
  connectStream(sessionId: string): StreamingClient;
}
```

## Configuration

### VS Code Settings

```typescript
// package.json contributions
{
  "configuration": {
    "title": "CodeLab",
    "properties": {
      "codelab.api.baseUrl": {
        "type": "string",
        "default": "http://localhost:8000",
        "description": "Backend API base URL"
      },
      "codelab.api.timeout": {
        "type": "number",
        "default": 30000,
        "description": "Request timeout (ms)"
      },
      "codelab.api.retryAttempts": {
        "type": "number",
        "default": 3,
        "minimum": 1,
        "maximum": 10,
        "description": "Number of retry attempts for failed requests"
      },
      "codelab.api.streamingEnabled": {
        "type": "boolean",
        "default": true,
        "description": "Enable Streaming Fetch API for real-time updates"
      }
    }
  }
}
```

### Loading Configuration

```typescript
// src/api/config.ts
import * as vscode from 'vscode';
import { z } from 'zod';

const APIConfigSchema = z.object({
  baseUrl: z.string().url(),
  timeout: z.number().positive(),
  retryAttempts: z.number().int().min(1).max(10),
  streamingEnabled: z.boolean()
});

export type APIConfig = z.infer<typeof APIConfigSchema>;

export function getAPIConfig(): APIConfig {
  const config = vscode.workspace.getConfiguration('codelab.api');
  
  const rawConfig = {
    baseUrl: config.get('baseUrl', 'http://localhost:8000'),
    timeout: config.get('timeout', 30000),
    retryAttempts: config.get('retryAttempts', 3),
    streamingEnabled: config.get('streamingEnabled', true)
  };
  
  return APIConfigSchema.parse(rawConfig);
}
```

## Authentication

### Token Storage

```typescript
// src/api/auth.ts
import * as vscode from 'vscode';

export class AuthManager {
  constructor(private context: vscode.ExtensionContext) {}
  
  async getToken(): Promise<string | undefined> {
    return await this.context.secrets.get('codelab.apiToken');
  }
  
  async setToken(token: string): Promise<void> {
    await this.context.secrets.store('codelab.apiToken', token);
  }
  
  async clearToken(): Promise<void> {
    await this.context.secrets.delete('codelab.apiToken');
  }
  
  getAuthHeaders(token: string): Record<string, string> {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }
}
```

## Zod Schemas

### Request/Response Schemas

```typescript
// src/api/schemas.ts
import { z } from 'zod';

// Health
export const HealthResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  version: z.string(),
  timestamp: z.string().datetime()
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// Chat Session
export const ChatSessionResponseSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export type ChatSessionResponse = z.infer<typeof ChatSessionResponseSchema>;

// Message
export const MessageRequestSchema = z.object({
  content: z.string().min(1),
  context: z.object({
    activeFile: z.object({
      path: z.string(),
      content: z.string(),
      languageId: z.string(),
      selection: z.object({
        start: z.object({ line: z.number(), character: z.number() }),
        end: z.object({ line: z.number(), character: z.number() }),
        text: z.string()
      }).optional()
    }).optional(),
    workspaceFiles: z.array(z.string()).optional(),
    diagnostics: z.array(z.object({
      file: z.string(),
      severity: z.enum(['error', 'warning', 'info']),
      message: z.string(),
      line: z.number(),
      character: z.number()
    })).optional()
  }).optional()
});

export type MessageRequest = z.infer<typeof MessageRequestSchema>;

export const MessageResponseSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  timestamp: z.string().datetime(),
  agent_id: z.string().optional()
});

export type MessageResponse = z.infer<typeof MessageResponseSchema>;

// Stream Event
export const StreamEventSchema = z.object({
  event_type: z.enum([
    'task_started',
    'task_progress',
    'task_completed',
    'error',
    'heartbeat'
  ]),
  payload: z.any(),
  session_id: z.string().uuid(),
  timestamp: z.string().datetime()
});

export type StreamEvent = z.infer<typeof StreamEventSchema>;
```

## REST API Client

### Base Implementation

```typescript
// src/api/client.ts
import { z } from 'zod';
import { AuthManager } from './auth';
import { getAPIConfig, type APIConfig } from './config';
import { APIError, NetworkError, ValidationError } from './errors';
import type * as vscode from 'vscode';

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
    const headers = {
      ...this.authManager.getAuthHeaders(token),
      ...options.headers
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
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new APIError(response.status, error.error_code || 'UNKNOWN', error.detail);
      }
      
      const data = await response.json();
      
      // Validate response with Zod if schema provided
      if (schema) {
        return schema.parse(data);
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
      
      if (error instanceof z.ZodError) {
        throw new ValidationError('Response validation failed', error);
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
  
  // ... остальные методы
}
```

### Error Handling

```typescript
// src/api/errors.ts
import { z } from 'zod';

export class APIError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class NetworkError extends Error {
  constructor(
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public zodError: z.ZodError
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Не retry на client errors (4xx)
      if (error instanceof APIError && error.status >= 400 && error.status < 500) {
        throw error;
      }
      
      if (attempt < maxAttempts - 1) {
        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
}
```

## Streaming Fetch API Client

### Implementation

```typescript
// src/api/streaming.ts
import { z } from 'zod';
import { StreamEventSchema, type StreamEvent } from './schemas';

export class StreamingClient {
  private abortController: AbortController | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isConnected = false;
  private eventHandlers: Map<string, (payload: any) => void> = new Map();
  
  constructor(
    private sessionId: string,
    private token: string,
    private baseUrl: string
  ) {}
  
  async connect(): Promise<void> {
    this.abortController = new AbortController();
    const url = `${this.baseUrl}/my/chat/${this.sessionId}/stream/`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'text/event-stream'
        },
        signal: this.abortController.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      if (!response.body) {
        throw new Error('Response body is null');
      }
      
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.onConnected?.();
      
      await this.readStream(response.body);
      
    } catch (error) {
      if ((error as any).name === 'AbortError') {
        return;
      }
      this.handleConnectionError(error as Error);
    }
  }
  
  private async readStream(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          this.isConnected = false;
          this.handleConnectionError(new Error('Stream ended'));
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          this.processLine(line);
        }
      }
    } catch (error) {
      this.isConnected = false;
      this.handleConnectionError(error as Error);
    } finally {
      reader.releaseLock();
    }
  }
  
  private processLine(line: string): void {
    if (!line.trim()) return;
    
    // Heartbeat
    if (line.startsWith(': heartbeat')) {
      this.onHeartbeat?.();
      return;
    }
    
    // Event data
    if (line.startsWith('data: ')) {
      try {
        const eventData = JSON.parse(line.substring(6));
        const event = StreamEventSchema.parse(eventData);
        this.handleEvent(event);
      } catch (error) {
        console.error('Failed to parse event:', error);
        this.onError?.(error as Error);
      }
    }
  }
  
  private handleEvent(event: StreamEvent): void {
    const handler = this.eventHandlers.get(event.event_type);
    if (handler) {
      handler(event.payload);
    }
  }
  
  private handleConnectionError(error: Error): void {
    this.isConnected = false;
    this.onError?.(error);
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
      
      setTimeout(() => {
        this.connect().catch(err => {
          console.error('Reconnect failed:', err);
        });
      }, delay);
    } else {
      this.onMaxReconnectAttemptsReached?.();
    }
  }
  
  disconnect(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isConnected = false;
  }
  
  on(eventType: string, handler: (payload: any) => void): void {
    this.eventHandlers.set(eventType, handler);
  }
  
  off(eventType: string): void {
    this.eventHandlers.delete(eventType);
  }
  
  // Callbacks
  onConnected?: () => void;
  onHeartbeat?: () => void;
  onError?: (error: Error) => void;
  onMaxReconnectAttemptsReached?: () => void;
  
  getConnectionState(): boolean {
    return this.isConnected;
  }
}
```

## Context Collection

### Project Context

```typescript
// src/context/collector.ts
import * as vscode from 'vscode';
import { z } from 'zod';

const ProjectContextSchema = z.object({
  activeFile: z.object({
    path: z.string(),
    content: z.string(),
    languageId: z.string(),
    selection: z.object({
      start: z.object({ line: z.number(), character: z.number() }),
      end: z.object({ line: z.number(), character: z.number() }),
      text: z.string()
    }).optional()
  }).optional(),
  workspaceFiles: z.array(z.string()).optional(),
  diagnostics: z.array(z.object({
    file: z.string(),
    severity: z.enum(['error', 'warning', 'info']),
    message: z.string(),
    line: z.number(),
    character: z.number()
  })).optional(),
  symbols: z.array(z.object({
    name: z.string(),
    kind: z.string(),
    location: z.string()
  })).optional()
});

export type ProjectContext = z.infer<typeof ProjectContextSchema>;

export class ContextCollector {
  private workspaceFilesCache: string[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 60000; // 1 minute
  
  async collectContext(): Promise<ProjectContext> {
    const context: ProjectContext = {};
    
    // Active file
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const content = editor.document.getText();
      
      // Check file size limit (1MB)
      if (content.length <= 1048576) {
        context.activeFile = {
          path: vscode.workspace.asRelativePath(editor.document.uri),
          content,
          languageId: editor.document.languageId
        };
        
        // Selection
        if (!editor.selection.isEmpty) {
          context.activeFile.selection = {
            start: {
              line: editor.selection.start.line,
              character: editor.selection.start.character
            },
            end: {
              line: editor.selection.end.line,
              character: editor.selection.end.character
            },
            text: editor.document.getText(editor.selection)
          };
        }
      }
    }
    
    // Workspace files (cached)
    context.workspaceFiles = await this.getWorkspaceFiles();
    
    // Diagnostics
    context.diagnostics = await this.getDiagnostics();
    
    // Validate context
    return ProjectContextSchema.parse(context);
  }
  
  private async getWorkspaceFiles(): Promise<string[]> {
    const now = Date.now();
    
    // Return cached if valid
    if (this.workspaceFilesCache && (now - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.workspaceFilesCache;
    }
    
    const files = await vscode.workspace.findFiles(
      '**/*',
      '**/node_modules/**',
      100 // Limit
    );
    
    this.workspaceFilesCache = files.map(uri => vscode.workspace.asRelativePath(uri));
    this.cacheTimestamp = now;
    
    return this.workspaceFilesCache;
  }
  
  private async getDiagnostics(): Promise<ProjectContext['diagnostics']> {
    const diagnostics: ProjectContext['diagnostics'] = [];
    
    for (const [uri, diags] of vscode.languages.getDiagnostics()) {
      for (const diag of diags) {
        diagnostics.push({
          file: vscode.workspace.asRelativePath(uri),
          severity: this.mapSeverity(diag.severity),
          message: diag.message,
          line: diag.range.start.line,
          character: diag.range.start.character
        });
      }
    }
    
    return diagnostics;
  }
  
  private mapSeverity(severity: vscode.DiagnosticSeverity): 'error' | 'warning' | 'info' {
    switch (severity) {
      case vscode.DiagnosticSeverity.Error:
        return 'error';
      case vscode.DiagnosticSeverity.Warning:
        return 'warning';
      default:
        return 'info';
    }
  }
  
  clearCache(): void {
    this.workspaceFilesCache = null;
    this.cacheTimestamp = 0;
  }
}
```

## Integration Example

### Complete Flow

```typescript
// src/api/index.ts
import * as vscode from 'vscode';
import { APIClient } from './client';
import { StreamingClient } from './streaming';
import { ContextCollector } from '../context/collector';
import { AuthManager } from './auth';
import { getAPIConfig } from './config';
import { withRetry } from './errors';

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
    await withRetry(() => 
      this.client.sendMessage(sessionId!, {
        content,
        context: projectContext
      })
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
    if (!this.streamingClient) return;
    
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
  
  dispose(): void {
    this.streamingClient?.disconnect();
    this.contextCollector.clearCache();
  }
}
```

## Testing Strategy

### Unit Tests

```typescript
// src/api/__tests__/client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APIClient } from '../client';
import { APIError } from '../errors';

describe('APIClient', () => {
  let client: APIClient;
  let mockContext: any;
  
  beforeEach(() => {
    mockContext = {
      secrets: {
        get: vi.fn().mockResolvedValue('test-token'),
        store: vi.fn(),
        delete: vi.fn()
      }
    };
    client = new APIClient(mockContext);
  });
  
  it('should create session', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'session-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    });
    
    const session = await client.createSession();
    expect(session.id).toBe('session-123');
  });
  
  it('should handle 401 error', async () => {
    mockContext.secrets.get.mockResolvedValue(null);
    
    await expect(client.createSession()).rejects.toThrow(APIError);
  });
  
  it('should validate response with Zod', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ invalid: 'data' })
    });
    
    await expect(client.createSession()).rejects.toThrow();
  });
});
```

### Integration Tests

```typescript
// src/api/__tests__/integration.test.ts
import { describe, it, expect } from 'vitest';
import { CodeLabAPI } from '../index';

describe('API Integration', () => {
  it('should complete full flow', async () => {
    const api = new CodeLabAPI(mockContext);
    
    // Send message
    await api.sendMessage('Hello');
    
    // Wait for response
    await new Promise(resolve => {
      api.onTaskCompleted = () => resolve(undefined);
    });
    
    api.dispose();
  });
});
```

## Performance Considerations

1. **Connection Pooling** - Fetch API автоматически переиспользует connections
2. **Request Batching** - группировка запросов где возможно
3. **Context Caching** - кэширование workspace files (TTL 1 минута)
4. **Lazy Loading** - загрузка данных по требованию
5. **Memory Management** - очистка старых событий и кэшей

## Security Considerations

1. **Token Storage** - только в SecretStorage
2. **HTTPS** - обязательно для production
3. **Input Validation** - Zod для всех входных данных
4. **Rate Limiting** - client-side throttling
5. **Error Messages** - не раскрывать sensitive информацию

## Best Practices

### 1. Always use Zod for validation
```typescript
const data = await response.json();
return MySchema.parse(data); // Throws if invalid
```

### 2. Use typed errors
```typescript
throw new APIError(404, 'NOT_FOUND', 'Resource not found');
```

### 3. Implement retry with exponential backoff
```typescript
await withRetry(() => apiCall(), 3, 1000);
```

### 4. Clean up resources
```typescript
dispose(): void {
  this.streamingClient?.disconnect();
  this.contextCollector.clearCache();
}
```

### 5. Handle AbortController properly
```typescript
const controller = new AbortController();
setTimeout(() => controller.abort(), timeout);
```
