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
