/**
 * File System Executor
 * Выполняет file system операции: read_file (для MVP)
 * Использует PathValidator для безопасности
 */

import * as fs from 'fs';
import { PathValidator } from './PathValidator';
import { ExecutorResult } from './types';
import { ReadFileParamsSchema } from './schemas';
import { TraceLogger } from './TraceLogger';

export class FileSystemExecutor {
  private pathValidator: PathValidator;
  private readonly maxFileSize: number;
  private readonly enableLogging: boolean;
  private traceLogger: TraceLogger;

  constructor(workspaceRoot: string, options?: { maxFileSize?: number; enableLogging?: boolean }) {
    this.pathValidator = new PathValidator(workspaceRoot);
    this.maxFileSize = options?.maxFileSize || 104857600; // 100MB default
    this.enableLogging = options?.enableLogging !== false;

    // Initialize trace logger
    this.traceLogger = new TraceLogger('FileSystemExecutor', {
      enableConsole: this.enableLogging,
      maxTraces: 1000
    });

    this.traceLogger.info('FileSystemExecutor initialized', {
      workspaceRoot,
      maxFileSize: this.maxFileSize
    });
  }

  /**
   * Read file contents
   * @param params - { path: string, encoding?: 'utf-8' | 'ascii' | 'binary' }
   * @returns FileReadResult with success/output/error
   */
  async readFile(params: Record<string, any>): Promise<ExecutorResult> {
    const startTime = Date.now();

    this.traceLogger.phaseStart('READ_FILE', {
      path: params.path,
      encoding: params.encoding || 'utf-8'
    });

    try {
      // Validate parameters using Zod
      this.traceLogger.step('READ_FILE', 'VALIDATE_PARAMS', {
        path: params.path
      });

      const validatedParams = ReadFileParamsSchema.parse(params);
      const { path: filePath, encoding = 'utf-8' } = validatedParams;

      this.traceLogger.validation('params_validation', true);
      this.traceLogger.params('READ_FILE_INPUT', {
        path: filePath,
        encoding
      });

      this.log(`[FileSystemExecutor] Reading file: ${filePath}`);

      // Validate path for security
      this.traceLogger.step('READ_FILE', 'VALIDATE_PATH', {
        path: filePath
      });

      const absolutePath = this.pathValidator.validateReadPath(filePath, {
        checkWorkspaceBoundary: true,
        checkExists: true,
        checkReadable: true,
        maxFileSize: this.maxFileSize
      });

      this.traceLogger.validation('path_validation', true, `Path validated: ${absolutePath}`);
      this.log(`[FileSystemExecutor] Validated path: ${absolutePath}`);

      // Read file
      this.traceLogger.step('READ_FILE', 'READ_FILE_CONTENT', {
        absolutePath
      });

      const content = fs.readFileSync(absolutePath, encoding as BufferEncoding);

      const stats = fs.statSync(absolutePath);

      this.traceLogger.trace('FILE_READ_SUCCESS', {
        path: filePath,
        absolutePath,
        size: stats.size,
        encoding,
        duration: Date.now() - startTime
      });

      this.log(`[FileSystemExecutor] Successfully read file (${stats.size} bytes, ${Date.now() - startTime}ms)`);

      const result: ExecutorResult = {
        success: true,
        output: content,
        size_bytes: stats.size,
        encoding
      };

      this.traceLogger.phaseEnd('READ_FILE', Date.now() - startTime, {
        path: filePath,
        size: stats.size,
        success: true
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = this.getErrorMessage(error);

      this.log(`[FileSystemExecutor] Error reading file: ${errorMessage}`);

      this.traceLogger.error('Error reading file', {
        path: params.path,
        duration
      }, error instanceof Error ? error : undefined);

      const errorResult: ExecutorResult = {
        success: false,
        error: errorMessage
      };

      this.traceLogger.phaseEnd('READ_FILE', duration, {
        path: params.path,
        success: false,
        error: errorMessage
      });

      return errorResult;
    }
  }

  /**
   * List directory contents
   * @param params - { path: string }
   * @returns ToolExecutionResult with success/output/error
   */
  async listDirectory(params: Record<string, any>): Promise<ExecutorResult> {
    const startTime = Date.now();

    this.traceLogger.phaseStart('LIST_DIRECTORY', {
      path: params.path
    });

    try {
      const dirPath = params.path as string;

      this.traceLogger.step('LIST_DIRECTORY', 'VALIDATE_PARAMS', {
        path: dirPath
      });

      if (!dirPath || typeof dirPath !== 'string') {
        throw new Error('Path parameter is required and must be a string');
      }

      this.traceLogger.validation('path_type_check', true, `Path is string: ${typeof dirPath}`);
      this.log(`[FileSystemExecutor] Listing directory: ${dirPath}`);

      // Validate path for security
      this.traceLogger.step('LIST_DIRECTORY', 'VALIDATE_PATH', {
        path: dirPath
      });

      const absolutePath = this.pathValidator.validateDirectoryPath(dirPath, {
        checkWorkspaceBoundary: true,
        checkExists: true
      });

      this.traceLogger.validation('path_validation', true, `Path validated: ${absolutePath}`);
      this.log(`[FileSystemExecutor] Validated directory path: ${absolutePath}`);

      // List directory
      this.traceLogger.step('LIST_DIRECTORY', 'READ_DIRECTORY', {
        absolutePath
      });

      const entries = fs.readdirSync(absolutePath, { withFileTypes: true });

      this.traceLogger.trace('DIRECTORY_ENTRIES_READ', {
        path: dirPath,
        entriesCount: entries.length,
        directories: entries.filter(e => e.isDirectory()).length,
        files: entries.filter(e => !e.isDirectory()).length
      });

      const files = entries.map(entry => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        path: `${dirPath}/${entry.name}`
      }));

      this.traceLogger.trace('DIRECTORY_LISTING_SUCCESS', {
        path: dirPath,
        absolutePath,
        entriesCount: files.length,
        duration: Date.now() - startTime
      });

      this.log(
        `[FileSystemExecutor] Successfully listed directory (${files.length} entries, ${Date.now() - startTime}ms)`
      );

      const result: ExecutorResult = {
        success: true,
        output: JSON.stringify(files, null, 2)
      };

      this.traceLogger.phaseEnd('LIST_DIRECTORY', Date.now() - startTime, {
        path: dirPath,
        entriesCount: files.length,
        success: true
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = this.getErrorMessage(error);

      this.log(`[FileSystemExecutor] Error listing directory: ${errorMessage}`);

      this.traceLogger.error('Error listing directory', {
        path: params.path,
        duration
      }, error instanceof Error ? error : undefined);

      const errorResult: ExecutorResult = {
        success: false,
        error: errorMessage
      };

      this.traceLogger.phaseEnd('LIST_DIRECTORY', duration, {
        path: params.path,
        success: false,
        error: errorMessage
      });

      return errorResult;
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
  ): Promise<ExecutorResult> {
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
