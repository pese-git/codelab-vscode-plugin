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
    const url = `${this.baseUrl}/my/chat/${this.sessionId}/events/`;
    
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
      const event = StreamEventSchema.parse(eventData);
      
      // Обработка heartbeat событий
      if (event.event_type === 'heartbeat') {
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
