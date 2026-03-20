import { StreamEventSchema, type StreamEvent } from './schemas';
import type { ToolHandler } from '../tools/ToolHandler';

export class StreamingClient {
  private abortController: AbortController | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isConnected = false;
  private isManuallyDisconnected = false;
  private connectionId = 0;
  private eventHandlers: Map<string, Array<(event: StreamEvent) => void>> = new Map();
  
  constructor(
    private projectId: string,
    private sessionId: string,
    private token: string,
    private baseUrl: string,
    private toolHandler?: ToolHandler
  ) {
    this.registerToolHandlers();
  }
  
  private registerToolHandlers(): void {
    if (!this.toolHandler) {
      return;
    }
    
    console.log('[StreamingClient] Registering tool handlers');
    
    // Register tool event handlers
    this.on('tool.approval_request', (event) => {
      console.log('[StreamingClient] Forwarding tool.approval_request to ToolHandler');
      this.toolHandler?.handleToolApprovalRequest(event as any);
    });
    
    this.on('tool.execution_signal', (event) => {
      console.log('[StreamingClient] Forwarding tool.execution_signal to ToolHandler');
      this.toolHandler?.handleToolExecutionSignal(event as any);
    });
    
    this.on('tool.result_ack', (event) => {
      console.log('[StreamingClient] Forwarding tool.result_ack to ToolHandler');
      this.toolHandler?.handleToolResultAck(event as any);
    });
    
    this.on('tool_result', (event) => {
      console.log('[StreamingClient] Received tool_result event - tool result submitted successfully');
    });
  }
  
  setToolHandler(toolHandler: ToolHandler): void {
    console.log('[StreamingClient] setToolHandler called');
    this.toolHandler = toolHandler;
    this.registerToolHandlers();
  }
  
  async connect(): Promise<void> {
    this.isManuallyDisconnected = false;
    this.connectionId++;
    const currentConnectionId = this.connectionId;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.abortController = new AbortController();
    const url = `${this.baseUrl}/my/projects/${this.projectId}/chat/${this.sessionId}/events/`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/x-ndjson'
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
      void this.readStream(response.body, currentConnectionId);
      
    } catch (error) {
      if ((error as any).name === 'AbortError' || this.isManuallyDisconnected) {
        return;
      }
      this.handleConnectionError(error as Error, currentConnectionId);
    }
  }
  
  private async readStream(
    body: ReadableStream<Uint8Array>,
    currentConnectionId: number
  ): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          this.isConnected = false;
          this.handleConnectionError(new Error('Stream ended'), currentConnectionId);
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
      if (!this.isManuallyDisconnected) {
        this.handleConnectionError(error as Error, currentConnectionId);
      }
    } finally {
      reader.releaseLock();
    }
  }
  
  private processLine(line: string): void {
    if (!line.trim()) {return;}
    
    try {
      // NDJSON format - каждая строка это JSON объект
      const eventData = JSON.parse(line);
      console.log('[StreamingClient] Raw event data from stream:', eventData);
      const event = StreamEventSchema.parse(eventData);
      console.log('[StreamingClient] Event parsed successfully:', event);
      
      // Ignore heartbeat events
      const eventType = (event.type || event.event_type) as string;
      if (eventType === 'heartbeat') {
        this.onHeartbeat?.();
        return;
      }
      
      this.handleEvent(event);
    } catch (error) {
      console.error('Failed to parse event:', error);
      this.onError?.(error as Error);
    }
  }
  
  private handleEvent(event: StreamEvent): void {
    const eventType = (event.type || event.event_type) as string;
    console.log(`[StreamingClient] Received event type: "${eventType}"`, event);
    const handlers = this.eventHandlers.get(eventType);
    if (handlers && handlers.length > 0) {
      console.log(`[StreamingClient] ${handlers.length} handler(s) found for "${eventType}", executing...`);
      for (const handler of handlers) {
        handler(event);
      }
    } else {
      console.warn(`[StreamingClient] No handler registered for event type: "${eventType}"`);
      console.log(`[StreamingClient] Available handlers:`, Array.from(this.eventHandlers.keys()));
    }
  }
  
  private handleConnectionError(error: Error, currentConnectionId: number): void {
    if (this.isManuallyDisconnected || currentConnectionId !== this.connectionId) {
      return;
    }

    this.isConnected = false;
    this.onError?.(error);
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
      
      this.reconnectTimeout = setTimeout(() => {
        if (this.isManuallyDisconnected || currentConnectionId !== this.connectionId) {
          return;
        }

        this.connect().catch(err => {
          console.error('Reconnect failed:', err);
        });
      }, delay);
    } else {
      this.onMaxReconnectAttemptsReached?.();
    }
  }
  
  disconnect(): void {
    this.isManuallyDisconnected = true;
    this.connectionId++;
    this.reconnectAttempts = 0;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isConnected = false;
  }
  
  on(eventType: string, handler: (event: StreamEvent) => void): void {
    const handlers = this.eventHandlers.get(eventType) || [];
    handlers.push(handler);
    this.eventHandlers.set(eventType, handlers);
    console.log(`[StreamingClient] Handler registered for "${eventType}". Total handlers: ${handlers.length}`);
  }
  
  off(eventType: string): void {
    this.eventHandlers.delete(eventType);
    console.log(`[StreamingClient] Handlers removed for "${eventType}"`);
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
