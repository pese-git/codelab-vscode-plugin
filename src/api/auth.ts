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
