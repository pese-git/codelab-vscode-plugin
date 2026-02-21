/**
 * File System Executor
 * Выполняет file system операции: read_file (для MVP)
 * Использует PathValidator для безопасности
 */

import * as fs from 'fs';
import { PathValidator } from './PathValidator';
import { FileReadResult, ToolExecutionResult } from './types';
import { ReadFileParamsSchema } from './schemas';

export class FileSystemExecutor {
  private pathValidator: PathValidator;
  private readonly maxFileSize: number;
  private readonly enableLogging: boolean;

  constructor(workspaceRoot: string, options?: { maxFileSize?: number; enableLogging?: boolean }) {
    this.pathValidator = new PathValidator(workspaceRoot);
    this.maxFileSize = options?.maxFileSize || 104857600; // 100MB default
    this.enableLogging = options?.enableLogging !== false;
  }

  /**
   * Read file contents
   * @param params - { path: string, encoding?: 'utf-8' | 'ascii' | 'binary' }
   * @returns FileReadResult with success/output/error
   */
  async readFile(params: Record<string, any>): Promise<FileReadResult> {
    const startTime = Date.now();

    try {
      // Validate parameters using Zod
      const validatedParams = ReadFileParamsSchema.parse(params);
      const { path: filePath, encoding = 'utf-8' } = validatedParams;

      this.log(`[FileSystemExecutor] Reading file: ${filePath}`);

      // Validate path for security
      const absolutePath = this.pathValidator.validateReadPath(filePath, {
        checkWorkspaceBoundary: true,
        checkExists: true,
        checkReadable: true,
        maxFileSize: this.maxFileSize
      });

      this.log(`[FileSystemExecutor] Validated path: ${absolutePath}`);

      // Read file
      const content = fs.readFileSync(absolutePath, encoding as BufferEncoding);

      const stats = fs.statSync(absolutePath);

      this.log(`[FileSystemExecutor] Successfully read file (${stats.size} bytes, ${Date.now() - startTime}ms)`);

      return {
        success: true,
        output: content,
        size_bytes: stats.size,
        encoding
      };
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);

      this.log(`[FileSystemExecutor] Error reading file: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * List directory contents
   * @param params - { path: string }
   * @returns ToolExecutionResult with success/output/error
   */
  async listDirectory(params: Record<string, any>): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      const dirPath = params.path as string;

      if (!dirPath || typeof dirPath !== 'string') {
        throw new Error('Path parameter is required and must be a string');
      }

      this.log(`[FileSystemExecutor] Listing directory: ${dirPath}`);

      // Validate path for security
      const absolutePath = this.pathValidator.validateDirectoryPath(dirPath, {
        checkWorkspaceBoundary: true,
        checkExists: true
      });

      this.log(`[FileSystemExecutor] Validated directory path: ${absolutePath}`);

      // List directory
      const entries = fs.readdirSync(absolutePath, { withFileTypes: true });

      const files = entries.map(entry => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        path: `${dirPath}/${entry.name}`
      }));

      this.log(
        `[FileSystemExecutor] Successfully listed directory (${files.length} entries, ${Date.now() - startTime}ms)`
      );

      return {
        success: true,
        output: JSON.stringify(files, null, 2)
      };
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);

      this.log(`[FileSystemExecutor] Error listing directory: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Execute any file operation
   * @param operation - 'read_file' | 'list_directory'
   * @param params - operation parameters
   * @returns ToolExecutionResult
   */
  async execute(
    operation: 'read_file' | 'list_directory',
    params: Record<string, any>
  ): Promise<ToolExecutionResult> {
    switch (operation) {
      case 'read_file':
        return this.readFile(params);
      case 'list_directory':
        return this.listDirectory(params);
      default:
        return {
          success: false,
          error: `Unknown operation: ${operation}`
        };
    }
  }

  /**
   * Get workspace root
   */
  getWorkspaceRoot(): string {
    return this.pathValidator.getWorkspaceRoot();
  }

  /**
   * Extract error message from various error types
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Unknown error occurred';
  }

  /**
   * Logging utility
   */
  private log(message: string): void {
    if (this.enableLogging) {
      console.log(message);
    }
  }
}
