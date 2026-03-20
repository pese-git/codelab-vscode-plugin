import * as vscode from 'vscode';
import { CodeLabAPI } from './api';
import { ChatViewProvider } from './ui/ChatViewProvider';
import { registerCommands } from './commands';
import { ToolHandler } from './tools/ToolHandler';
import type { Logger } from './tools/ToolHandler';

let toolHandler: ToolHandler | null = null;

// Dummy approval dialog provider - actual dialogs are handled by the webview
const dummyApprovalDialogProvider = {
  showApprovalDialog: () => {
    // Dialogs are shown in webview, not here
  }
};

export function activate(context: vscode.ExtensionContext) {
  console.log('CodeLab extension is now active');
  
  // Initialize API
  const api = new CodeLabAPI(context);
  
  // Create logger for ToolHandler
  const logger: Logger = {
    info: (message: string) => console.log('[ToolHandler]', message),
    debug: (message: string) => console.log('[ToolHandler:DEBUG]', message),
    error: (message: string) => console.error('[ToolHandler:ERROR]', message)
  };
  
  // Initialize ToolHandler with workspace root
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
  toolHandler = new ToolHandler(
    api,
    dummyApprovalDialogProvider,
    logger,
    workspaceRoot,
    {
      commandTimeoutMs: 30000,
      fileSizeMaxBytes: 5 * 1024 * 1024, // 5MB
      concurrencyLimit: 3,
      approvalTimeoutMs: 300000 // 5 minutes
    }
  );
  
  // Connect ToolHandler to API for streaming
  api.setToolHandler(toolHandler);
  
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
      if (toolHandler) {
        toolHandler.dispose();
      }
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
  if (toolHandler) {
    toolHandler.dispose();
    toolHandler = null;
  }
}
