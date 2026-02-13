import * as vscode from 'vscode';

export interface DiffOperation {
  type: 'unified-diff';
  filePath: string;
  diff: string;
}

export class DiffEngine {
  async applyDiff(diff: string): Promise<void> {
    const operations = this.parseDiff(diff);
    
    if (operations.length === 0) {
      vscode.window.showWarningMessage('No valid diff operations found');
      return;
    }
    
    // Show preview
    const confirmed = await this.showPreview(operations);
    if (!confirmed) {
      return;
    }
    
    // Apply changes
    await this.applyOperations(operations);
  }
  
  private parseDiff(diff: string): DiffOperation[] {
    const operations: DiffOperation[] = [];
    
    // Split by file headers (--- a/path and +++ b/path)
    const fileBlocks = diff.split(/(?=^--- a\/)/m);
    
    for (const block of fileBlocks) {
      if (!block.trim()) {continue;}
      
      const lines = block.split('\n');
      const filePathMatch = lines[0]?.match(/^--- a\/(.+)$/);
      
      if (filePathMatch) {
        operations.push({
          type: 'unified-diff',
          filePath: filePathMatch[1],
          diff: block
        });
      }
    }
    
    return operations;
  }
  
  private async showPreview(operations: DiffOperation[]): Promise<boolean> {
    const fileList = operations.map(op => op.filePath).join('\n');
    
    const choice = await vscode.window.showInformationMessage(
      `Apply changes to ${operations.length} file(s)?\n\n${fileList}`,
      { modal: true },
      'Apply',
      'Cancel'
    );
    
    return choice === 'Apply';
  }
  
  private async applyOperations(operations: DiffOperation[]): Promise<void> {
    const edit = new vscode.WorkspaceEdit();
    
    for (const operation of operations) {
      try {
        await this.applyUnifiedDiff(edit, operation);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to apply changes to ${operation.filePath}: ${error}`
        );
      }
    }
    
    const success = await vscode.workspace.applyEdit(edit);
    
    if (success) {
      vscode.window.showInformationMessage(
        `Successfully applied changes to ${operations.length} file(s)`
      );
    } else {
      vscode.window.showErrorMessage('Failed to apply some changes');
    }
  }
  
  private async applyUnifiedDiff(
    edit: vscode.WorkspaceEdit,
    operation: DiffOperation
  ): Promise<void> {
    // Find workspace folder
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('No workspace folder open');
    }
    
    const fileUri = vscode.Uri.joinPath(
      workspaceFolders[0].uri,
      operation.filePath
    );
    
    // Parse unified diff
    const hunks = this.parseUnifiedDiff(operation.diff);
    
    // Check if file exists
    try {
      await vscode.workspace.openTextDocument(fileUri);
    } catch {
      // File doesn't exist, create it
      edit.createFile(fileUri, { ignoreIfExists: true });
      await vscode.workspace.openTextDocument(fileUri);
    }
    
    // Apply hunks in reverse order to maintain line numbers
    for (let i = hunks.length - 1; i >= 0; i--) {
      const hunk = hunks[i];
      const range = new vscode.Range(
        hunk.startLine,
        0,
        hunk.startLine + hunk.oldLines.length,
        0
      );
      
      const newText = hunk.newLines.join('\n') + (hunk.newLines.length > 0 ? '\n' : '');
      edit.replace(fileUri, range, newText);
    }
  }
  
  private parseUnifiedDiff(diff: string): Array<{
    startLine: number;
    oldLines: string[];
    newLines: string[];
  }> {
    const hunks: Array<{
      startLine: number;
      oldLines: string[];
      newLines: string[];
    }> = [];
    
    const lines = diff.split('\n');
    let i = 0;
    
    // Skip file headers
    while (i < lines.length && !lines[i].startsWith('@@')) {
      i++;
    }
    
    while (i < lines.length) {
      const line = lines[i];
      
      if (line.startsWith('@@')) {
        // Parse hunk header: @@ -start,count +start,count @@
        const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
        if (match) {
          const startLine = parseInt(match[1]) - 1; // Convert to 0-based
          const oldLines: string[] = [];
          const newLines: string[] = [];
          
          i++;
          while (i < lines.length && !lines[i].startsWith('@@')) {
            const diffLine = lines[i];
            
            if (diffLine.startsWith('-')) {
              oldLines.push(diffLine.substring(1));
            } else if (diffLine.startsWith('+')) {
              newLines.push(diffLine.substring(1));
            } else if (diffLine.startsWith(' ')) {
              oldLines.push(diffLine.substring(1));
              newLines.push(diffLine.substring(1));
            }
            
            i++;
          }
          
          hunks.push({ startLine, oldLines, newLines });
        } else {
          i++;
        }
      } else {
        i++;
      }
    }
    
    return hunks;
  }
}
