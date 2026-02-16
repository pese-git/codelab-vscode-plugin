import * as vscode from 'vscode';
import { CodeLabAPI, APIError, ValidationError, NetworkError } from '../api';
import { DiffEngine } from '../diff/engine';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'codelab.chatView';
  
  private _view?: vscode.WebviewView;
  private diffEngine: DiffEngine;
  
  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly api: CodeLabAPI
  ) {
    this.diffEngine = new DiffEngine();
    this.setupAPIHandlers();
  }
  
  private isAuthError(error: any): boolean {
    return (error instanceof APIError && error.status === 401) ||
           error?.message?.includes('Not authenticated');
  }
  
  private async handleAuthError(): Promise<void> {
    const action = await vscode.window.showErrorMessage(
      'API token not set or expired. Please set your CodeLab API token.',
      'Set Token'
    );
    
    if (action === 'Set Token') {
      await vscode.commands.executeCommand('codelab.setApiToken');
    }
  }
  
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    console.log('[ChatViewProvider] Resolving webview view...');
    this._view = webviewView;
    
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview'),
        vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode', 'codicons')
      ]
    };
    
    console.log('[ChatViewProvider] Setting webview HTML...');
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    console.log('[ChatViewProvider] Webview HTML set');
    
    // Handle messages from React app
    webviewView.webview.onDidReceiveMessage(
      async (message) => {
        console.log('[ChatViewProvider] Received message from webview:', message);
        await this._handleMessage(message);
      }
    );
    
    console.log('[ChatViewProvider] Webview view resolved');
  }
  
  private _getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'index.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'index.css')
    );
    
    // Codicons font
    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
    );
    
    console.log('[ChatViewProvider] Script URI:', scriptUri.toString());
    console.log('[ChatViewProvider] Style URI:', styleUri.toString());
    console.log('[ChatViewProvider] Codicons URI:', codiconsUri.toString());
    
    const nonce = getNonce();
    
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy"
            content="default-src 'none';
                     style-src ${webview.cspSource} 'unsafe-inline';
                     script-src 'nonce-${nonce}';
                     font-src ${webview.cspSource};
                     img-src ${webview.cspSource} https: data:;
                     connect-src ${webview.cspSource} https:;">
      <link href="${codiconsUri}" rel="stylesheet">
      <link href="${styleUri}" rel="stylesheet">
      <title>CodeLab Chat</title>
    </head>
    <body>
      <div id="root"></div>
      <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
  }
  
  private async _handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'sendMessage':
        try {
          await this.api.sendMessage(message.content);
        } catch (error: any) {
          console.error('Error sending message:', error);
          
          if (this.isAuthError(error)) {
            await this.handleAuthError();
            this.postMessage({
              type: 'error',
              payload: { message: 'Authentication required. Please set your API token.' }
            });
          } else if (error instanceof ValidationError) {
            console.error('Validation error details:', error.getDetails());
            this.postMessage({
              type: 'error',
              payload: { message: `Validation error: ${error.message}` }
            });
            vscode.window.showErrorMessage(`Validation error: ${error.message}`);
          } else if (error instanceof NetworkError) {
            this.postMessage({
              type: 'error',
              payload: { message: `Network error: ${error.message}` }
            });
          } else if (error instanceof APIError) {
            this.postMessage({
              type: 'error',
              payload: { message: `API error (${error.status}): ${error.message}` }
            });
          } else {
            this.postMessage({
              type: 'error',
              payload: { message: `Error: ${error.message || String(error)}` }
            });
          }
        }
        break;
        
      case 'applyChanges':
        try {
          await this.diffEngine.applyDiff(message.diff);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to apply changes: ${error}`);
        }
        break;
        
      case 'copyCode':
        await vscode.env.clipboard.writeText(message.code);
        vscode.window.showInformationMessage('Code copied to clipboard');
        break;
        
      case 'newChat':
        await this.startNewChat();
        break;
        
      case 'loadSessions':
        await this.loadSessions();
        break;
        
      case 'switchSession':
        await this.switchSession(message.sessionId);
        break;
        
      case 'deleteSession':
        await this.deleteSession(message.sessionId);
        break;
        
      case 'ready':
        await this.sendInitialState();
        break;
    }
  }
  
  private setupAPIHandlers(): void {
    this.api.onTaskStarted = (payload) => {
      this.postMessage({ type: 'taskStarted', payload });
    };
    
    this.api.onTaskProgress = (payload) => {
      this.postMessage({ type: 'taskProgress', payload });
    };
    
    this.api.onTaskCompleted = (payload) => {
      this.postMessage({ type: 'taskCompleted', payload });
    };
    
    this.api.onError = (payload) => {
      this.postMessage({ type: 'error', payload });
    };
  }
  
  public postMessage(message: any): void {
    this._view?.webview.postMessage(message);
  }
  
  private async sendInitialState(): Promise<void> {
    console.log('[ChatViewProvider] sendInitialState called');
    try {
      const sessionId = await this.api.getCurrentSessionId();
      console.log('[ChatViewProvider] Current session ID:', sessionId);
      
      const messages = sessionId
        ? await this.api.getMessageHistory(sessionId)
        : { messages: [], total: 0, session_id: '' };
      
      console.log('[ChatViewProvider] Messages loaded:', messages.messages.length);
      
      this.postMessage({
        type: 'initialState',
        payload: {
          sessionId,
          messages: messages.messages
        }
      });
      console.log('[ChatViewProvider] initialState message sent');
    } catch (error: any) {
      console.error('[ChatViewProvider] Error in sendInitialState:', error);
      
      // Если ошибка аутентификации или любая другая, отправляем пустое состояние
      if (!this.isAuthError(error)) {
        console.error('Failed to load initial state:', error);
        if (error instanceof ValidationError) {
          console.error('Validation error details:', error.getDetails());
        }
        
        // Если сессия не найдена (404), очищаем currentSessionId
        if (error instanceof APIError && error.status === 404) {
          console.log('Session not found (404), clearing currentSessionId');
          await this.api.clearCurrentSessionId();
        }
      }
      
      console.log('[ChatViewProvider] Sending empty initialState');
      this.postMessage({
        type: 'initialState',
        payload: {
          sessionId: undefined,
          messages: []
        }
      });
    }
  }
  
  private async startNewChat(): Promise<void> {
    try {
      await this.api.createNewSession();
      await this.sendInitialState();
      await this.loadSessions();
      vscode.window.showInformationMessage('New chat session created');
    } catch (error: any) {
      console.error('Error creating new chat:', error);
      
      if (this.isAuthError(error)) {
        await this.handleAuthError();
      } else if (error instanceof ValidationError) {
        console.error('Validation error details:', error.getDetails());
        vscode.window.showErrorMessage(`Validation error: ${error.message}`);
      } else {
        vscode.window.showErrorMessage(`Failed to create new chat: ${error.message || String(error)}`);
      }
    }
  }
  
  private async loadSessions(): Promise<void> {
    console.log('[ChatViewProvider] loadSessions called');
    try {
      const response = await this.api.listSessions();
      console.log('[ChatViewProvider] Sessions loaded:', response.sessions.length);
      
      // Отправляем сессии без обогащения метаданными
      // WebView сам запросит детали при необходимости
      this.postMessage({
        type: 'sessionsLoaded',
        payload: {
          sessions: response.sessions
        }
      });
      console.log('[ChatViewProvider] sessionsLoaded message sent');
    } catch (error: any) {
      console.error('[ChatViewProvider] Error loading sessions:', error);
      
      if (this.isAuthError(error)) {
        await this.handleAuthError();
      } else {
        console.log('[ChatViewProvider] Sending empty sessions list');
        this.postMessage({
          type: 'sessionsLoaded',
          payload: { sessions: [] }
        });
      }
    }
  }
  
  private async switchSession(sessionId: string): Promise<void> {
    console.log('[ChatViewProvider] switchSession called with:', sessionId);
    try {
      // Сначала проверяем, существует ли сессия, загрузив её историю
      console.log('[ChatViewProvider] Loading message history...');
      const messages = await this.api.getMessageHistory(sessionId);
      console.log('[ChatViewProvider] Message history loaded:', messages.messages.length);
      
      // Если история загружена успешно, переключаемся
      console.log('[ChatViewProvider] Switching session in API...');
      await this.api.switchSession(sessionId);
      console.log('[ChatViewProvider] Session switched in API');
      
      console.log('[ChatViewProvider] Sending sessionSwitched message to webview');
      this.postMessage({
        type: 'sessionSwitched',
        payload: {
          sessionId,
          messages: messages.messages
        }
      });
      console.log('[ChatViewProvider] sessionSwitched message sent');
    } catch (error: any) {
      console.error('[ChatViewProvider] Error switching session:', error);
      
      if (this.isAuthError(error)) {
        await this.handleAuthError();
      } else if (error instanceof APIError && error.status === 404) {
        vscode.window.showWarningMessage('Session not found. It may have been deleted.');
        // Обновляем список сессий
        await this.loadSessions();
      } else {
        vscode.window.showErrorMessage(`Failed to switch session: ${error.message || String(error)}`);
      }
    }
  }
  
  private async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.api.deleteSession(sessionId);
      await this.loadSessions();
      vscode.window.showInformationMessage('Session deleted');
    } catch (error: any) {
      console.error('Error deleting session:', error);
      
      if (this.isAuthError(error)) {
        await this.handleAuthError();
      } else {
        vscode.window.showErrorMessage(`Failed to delete session: ${error.message || String(error)}`);
      }
    }
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
