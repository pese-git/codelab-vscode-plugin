import * as vscode from 'vscode';
import { CodeLabAPI } from '../api';

export function registerCommands(
  context: vscode.ExtensionContext,
  api: CodeLabAPI
): void {
  // Open Chat
  context.subscriptions.push(
    vscode.commands.registerCommand('codelab.openChat', async () => {
      await vscode.commands.executeCommand('codelab.chatView.focus');
    })
  );
  
  // Explain Selection
  context.subscriptions.push(
    vscode.commands.registerCommand('codelab.explainSelection', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty) {
        vscode.window.showWarningMessage('Please select code to explain');
        return;
      }
      
      const selectedText = editor.document.getText(editor.selection);
      await api.sendMessage(`Explain this code:\n\n${selectedText}`);
      await vscode.commands.executeCommand('codelab.chatView.focus');
    })
  );
  
  // Refactor Selection
  context.subscriptions.push(
    vscode.commands.registerCommand('codelab.refactorSelection', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty) {
        vscode.window.showWarningMessage('Please select code to refactor');
        return;
      }
      
      const selectedText = editor.document.getText(editor.selection);
      await api.sendMessage(`Suggest refactoring for this code:\n\n${selectedText}`);
      await vscode.commands.executeCommand('codelab.chatView.focus');
    })
  );
  
  // Fix Errors
  context.subscriptions.push(
    vscode.commands.registerCommand('codelab.fixErrors', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }
      
      const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
      const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
      
      if (errors.length === 0) {
        vscode.window.showInformationMessage('No errors found in current file');
        return;
      }
      
      const errorMessages = errors.map(e => 
        `Line ${e.range.start.line + 1}: ${e.message}`
      ).join('\n');
      
      await api.sendMessage(`Fix these errors:\n\n${errorMessages}`);
      await vscode.commands.executeCommand('codelab.chatView.focus');
    })
  );
  
  // Generate Code
  context.subscriptions.push(
    vscode.commands.registerCommand('codelab.generateCode', async () => {
      const description = await vscode.window.showInputBox({
        prompt: 'Describe the code you want to generate',
        placeHolder: 'e.g., Create a function to sort an array of objects by date'
      });
      
      if (!description) {
        return;
      }
      
      await api.sendMessage(`Generate code: ${description}`);
      await vscode.commands.executeCommand('codelab.chatView.focus');
    })
  );
  
  // Set API Token
  context.subscriptions.push(
    vscode.commands.registerCommand('codelab.setApiToken', async () => {
      const token = await vscode.window.showInputBox({
        prompt: 'Enter your CodeLab API token',
        password: true,
        placeHolder: 'Your API token'
      });
      
      if (!token) {
        return;
      }
      
      await context.secrets.store('codelab.apiToken', token);
      vscode.window.showInformationMessage('API token saved successfully');
    })
  );
}
