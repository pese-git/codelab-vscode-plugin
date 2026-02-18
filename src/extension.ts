import * as vscode from 'vscode';
import { CodeLabAPI } from './api';
import { ChatViewProvider } from './ui/ChatViewProvider';
import { registerCommands } from './commands';

export function activate(context: vscode.ExtensionContext) {
  console.log('CodeLab extension is now active');
  
  // Initialize API
  const api = new CodeLabAPI(context);
  
  // Register WebView Provider
  const chatViewProvider = new ChatViewProvider(context.extensionUri, api);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ChatViewProvider.viewType,
      chatViewProvider
    )
  );
  
  // Register commands
  registerCommands(context, api);
  
  // Cleanup on deactivation
  context.subscriptions.push({
    dispose: () => {
      api.dispose();
    }
  });
  
  // Check if API token is set and initialize project
  initializeExtension(context, api);
}

async function initializeExtension(context: vscode.ExtensionContext, api: CodeLabAPI): Promise<void> {
  const token = await context.secrets.get('codelab.apiToken');
  
  if (!token) {
    const choice = await vscode.window.showInformationMessage(
      'CodeLab API token is not set. Would you like to set it now?',
      'Set Token',
      'Later'
    );
    
    if (choice === 'Set Token') {
      await vscode.commands.executeCommand('codelab.setApiToken');
    }
    return;
  }
  
  // Try to get or create project at startup
  try {
    console.log('[Extension] Attempting to get or create project...');
    const projectId = await (api as any).getOrCreateProject();
    console.log('[Extension] Project ready:', projectId);
    vscode.window.showInformationMessage('CodeLab project initialized successfully');
  } catch (error) {
    console.error('[Extension] Error during initialization:', error);
    vscode.window.showErrorMessage(`Failed to initialize CodeLab: ${String(error)}`);
  }
}

export function deactivate() {
  console.log('CodeLab extension is now deactivated');
}
