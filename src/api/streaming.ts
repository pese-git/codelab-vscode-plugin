import { StreamEventSchema, type StreamEvent } from './schemas';

export class StreamingClient {
  private abortController: AbortController | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isConnected = false;
  private eventHandlers: Map<string, (event: StreamEvent) => void> = new Map();
  
  constructor(
    private projectId: string,
    private sessionId: string,
    private token: string,
    private baseUrl: string
  ) {}
  
  async connect(): Promise<void> {
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
    const handler = this.eventHandlers.get(eventType);
    if (handler) {
      console.log(`[StreamingClient] Handler found for "${eventType}", executing...`);
      handler(event);
    } else {
      console.warn(`[StreamingClient] No handler registered for event type: "${eventType}"`);
      console.log(`[StreamingClient] Available handlers:`, Array.from(this.eventHandlers.keys()));
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
  
  on(eventType: string, handler: (event: StreamEvent) => void): void {
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
