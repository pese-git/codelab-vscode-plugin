import * as vscode from 'vscode';
import { CodeLabAPI } from '../api';
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
  
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview')
      ]
    };
    
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    
    // Handle messages from React app
    webviewView.webview.onDidReceiveMessage(
      async (message) => await this._handleMessage(message)
    );
  }
  
  private _getHtmlForWebview(webview: vscode.Webview): string {
    // For now, return a simple HTML placeholder
    // In production, this would load the React app
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
                     img-src ${webview.cspSource} https:;
                     connect-src ${webview.cspSource} https:;">
      <title>CodeLab Chat</title>
      <style>
        body {
          padding: 0;
          margin: 0;
          font-family: var(--vscode-font-family);
          color: var(--vscode-foreground);
          background-color: var(--vscode-editor-background);
        }
        .container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          padding: 16px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--vscode-panel-border);
        }
        .messages {
          flex: 1;
          overflow-y: auto;
          margin-bottom: 16px;
        }
        .message {
          margin-bottom: 16px;
          padding: 12px;
          border-radius: 4px;
          background-color: var(--vscode-input-background);
        }
        .message.user {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
        }
        .input-area {
          display: flex;
          gap: 8px;
        }
        textarea {
          flex: 1;
          padding: 8px;
          border: 1px solid var(--vscode-input-border);
          background-color: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          font-family: var(--vscode-font-family);
          resize: none;
          min-height: 40px;
        }
        button {
          padding: 8px 16px;
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          cursor: pointer;
        }
        button:hover {
          background-color: var(--vscode-button-hoverBackground);
        }
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>CodeLab</h2>
          <button id="newChat">New Chat</button>
        </div>
        <div class="messages" id="messages"></div>
        <div class="input-area">
          <textarea id="input" placeholder="Type your message..."></textarea>
          <button id="send">Send</button>
        </div>
      </div>
      <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const messagesDiv = document.getElementById('messages');
        const input = document.getElementById('input');
        const sendBtn = document.getElementById('send');
        const newChatBtn = document.getElementById('newChat');
        
        let isLoading = false;
        
        function addMessage(content, role) {
          const messageDiv = document.createElement('div');
          messageDiv.className = 'message ' + role;
          messageDiv.textContent = content;
          messagesDiv.appendChild(messageDiv);
          messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
        
        function setLoading(loading) {
          isLoading = loading;
          sendBtn.disabled = loading;
          input.disabled = loading;
        }
        
        sendBtn.addEventListener('click', () => {
          const content = input.value.trim();
          if (!content || isLoading) return;
          
          addMessage(content, 'user');
          vscode.postMessage({ type: 'sendMessage', content });
          input.value = '';
          setLoading(true);
        });
        
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendBtn.click();
          }
        });
        
        newChatBtn.addEventListener('click', () => {
          vscode.postMessage({ type: 'newChat' });
        });
        
        window.addEventListener('message', (event) => {
          const message = event.data;
          
          switch (message.type) {
            case 'initialState':
              messagesDiv.innerHTML = '';
              message.payload.messages.forEach(msg => {
                addMessage(msg.content, msg.role);
              });
              break;
              
            case 'taskStarted':
              addMessage('Processing...', 'system');
              break;
              
            case 'taskCompleted':
              setLoading(false);
              addMessage(message.payload.result, 'assistant');
              break;
              
            case 'error':
              setLoading(false);
              addMessage('Error: ' + message.payload.message, 'system');
              break;
              
            case 'newChatCreated':
              messagesDiv.innerHTML = '';
              break;
          }
        });
        
        // Notify extension that webview is ready
        vscode.postMessage({ type: 'ready' });
      </script>
    </body>
    </html>`;
  }
  
  private async _handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'sendMessage':
        try {
          await this.api.sendMessage(message.content);
        } catch (error) {
          this.postMessage({
            type: 'error',
            payload: { message: String(error) }
          });
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
    const sessionId = await this.api.getCurrentSessionId();
    const messages = sessionId 
      ? await this.api.getMessageHistory(sessionId)
      : { messages: [], total: 0, session_id: '' };
    
    this.postMessage({
      type: 'initialState',
      payload: {
        sessionId,
        messages: messages.messages
      }
    });
  }
  
  private async startNewChat(): Promise<void> {
    try {
      await this.api.createNewSession();
      this.postMessage({ type: 'newChatCreated' });
      vscode.window.showInformationMessage('New chat session created');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create new chat: ${error}`);
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
