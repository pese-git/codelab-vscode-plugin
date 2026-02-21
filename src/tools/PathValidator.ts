/**
 * Path Validator
 * Валидирует и защищает пути для file operations
 * Проверяет: workspace boundaries, path traversal, file existence, sizes
 */

import * as fs from 'fs';
import * as path from 'path';
import { ToolSecurityError } from './types';

export interface ValidationOptions {
  checkWorkspaceBoundary?: boolean;
  checkExists?: boolean;
  checkReadable?: boolean;
  maxFileSize?: number;
}

export class PathValidator {
  private workspaceRoot: string;
  private readonly DEFAULT_MAX_FILE_SIZE = 104857600; // 100MB

  constructor(workspaceRoot: string) {
    // Normalize workspace root
    this.workspaceRoot = path.resolve(workspaceRoot);
    
    // Verify workspace exists
    if (!fs.existsSync(this.workspaceRoot)) {
      throw new Error(`Workspace root does not exist: ${this.workspaceRoot}`);
    }
  }

  /**
   * Validate file path for read operations
   * @param filePath - relative or absolute path
   * @param options - validation options
   * @returns absolute normalized path if valid
   * @throws ToolSecurityError if validation fails
   */
  validateReadPath(filePath: string, options: ValidationOptions = {}): string {
    const {
      checkWorkspaceBoundary = true,
      checkExists = true,
      checkReadable = true,
      maxFileSize = this.DEFAULT_MAX_FILE_SIZE
    } = options;

    // Validate input
    if (!filePath || typeof filePath !== 'string') {
      throw new ToolSecurityError('Path must be a non-empty string', 'read_file');
    }

    // Normalize path
    const absolutePath = this.normalizePath(filePath);

    // Check workspace boundary
    if (checkWorkspaceBoundary) {
      this.checkBoundary(absolutePath);
    }

    // Check existence
    if (checkExists && !fs.existsSync(absolutePath)) {
      throw new ToolSecurityError(
        `File not found: ${filePath}`,
        'read_file'
      );
    }

    // Check if it's a file (not directory)
    if (fs.existsSync(absolutePath)) {
      const stats = fs.statSync(absolutePath);
      if (!stats.isFile()) {
        throw new ToolSecurityError(
          `Path is not a file: ${filePath}`,
          'read_file'
        );
      }

      // Check file size
      if (stats.size > maxFileSize) {
        throw new ToolSecurityError(
          `File exceeds maximum size limit (${maxFileSize} bytes): ${filePath}`,
          'read_file'
        );
      }

      // Check readability
      if (checkReadable) {
        try {
          fs.accessSync(absolutePath, fs.constants.R_OK);
        } catch {
          throw new ToolSecurityError(
            `File is not readable: ${filePath}`,
            'read_file'
          );
        }
      }
    }

    return absolutePath;
  }

  /**
   * Validate file path for write operations
   * @param filePath - relative or absolute path
   * @param options - validation options
   * @returns absolute normalized path if valid
   * @throws ToolSecurityError if validation fails
   */
  validateWritePath(filePath: string, options: ValidationOptions = {}): string {
    const {
      checkWorkspaceBoundary = true
    } = options;

    // Validate input
    if (!filePath || typeof filePath !== 'string') {
      throw new ToolSecurityError('Path must be a non-empty string', 'read_file');
    }

    // Normalize path
    const absolutePath = this.normalizePath(filePath);

    // Check workspace boundary
    if (checkWorkspaceBoundary) {
      this.checkBoundary(absolutePath);
    }

    // Check directory exists and is writable
    const dirPath = path.dirname(absolutePath);
    if (!fs.existsSync(dirPath)) {
      throw new ToolSecurityError(
        `Directory does not exist: ${dirPath}`,
        'read_file'
      );
    }

    const dirStats = fs.statSync(dirPath);
    if (!dirStats.isDirectory()) {
      throw new ToolSecurityError(
        `Parent path is not a directory: ${dirPath}`,
        'read_file'
      );
    }

    try {
      fs.accessSync(dirPath, fs.constants.W_OK);
    } catch {
      throw new ToolSecurityError(
        `Directory is not writable: ${dirPath}`,
        'read_file'
      );
    }

    return absolutePath;
  }

  /**
   * Validate directory path for list operations
   * @param dirPath - relative or absolute path
   * @param options - validation options
   * @returns absolute normalized path if valid
   * @throws ToolSecurityError if validation fails
   */
  validateDirectoryPath(dirPath: string, options: ValidationOptions = {}): string {
    const { checkWorkspaceBoundary = true, checkExists = true } = options;

    // Validate input
    if (!dirPath || typeof dirPath !== 'string') {
      throw new ToolSecurityError('Path must be a non-empty string', 'read_file');
    }

    // Normalize path
    const absolutePath = this.normalizePath(dirPath);

    // Check workspace boundary
    if (checkWorkspaceBoundary) {
      this.checkBoundary(absolutePath);
    }

    // Check existence
    if (checkExists && !fs.existsSync(absolutePath)) {
      throw new ToolSecurityError(
        `Directory not found: ${dirPath}`,
        'read_file'
      );
    }

    // Check if it's a directory
    if (fs.existsSync(absolutePath)) {
      const stats = fs.statSync(absolutePath);
      if (!stats.isDirectory()) {
        throw new ToolSecurityError(
          `Path is not a directory: ${dirPath}`,
          'read_file'
        );
      }
    }

    return absolutePath;
  }

  /**
   * Normalize path and prevent path traversal
   * @param filePath - relative or absolute path
   * @returns absolute normalized path
   * @throws ToolSecurityError if path traversal detected
   */
  private normalizePath(filePath: string): string {
    // Resolve to absolute path
    let absolutePath: string;
    if (path.isAbsolute(filePath)) {
      absolutePath = path.resolve(filePath);
    } else {
      absolutePath = path.resolve(this.workspaceRoot, filePath);
    }

    // Normalize (remove .. and . components)
    absolutePath = path.normalize(absolutePath);

    // Resolve symlinks
    try {
      absolutePath = fs.realpathSync(absolutePath);
    } catch {
      // If file doesn't exist yet, just normalize
      // (for write operations creating new files)
    }

    return absolutePath;
  }

  /**
   * Check if path is within workspace boundary
   * @param absolutePath - absolute normalized path
   * @throws ToolSecurityError if path is outside workspace
   */
  private checkBoundary(absolutePath: string): void {
    // Ensure workspace root ends with separator for comparison
    const normalizedWorkspace = this.workspaceRoot.endsWith(path.sep)
      ? this.workspaceRoot
      : this.workspaceRoot + path.sep;

    // Check if path starts with workspace root
    if (!absolutePath.startsWith(normalizedWorkspace) && absolutePath !== this.workspaceRoot) {
      throw new ToolSecurityError(
        `Path is outside workspace boundary: ${absolutePath}`,
        'read_file'
      );
    }
  }

  /**
   * Get workspace root
   */
  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  /**
   * Check if path is within workspace
   */
  isWithinWorkspace(filePath: string): boolean {
    try {
      const absolutePath = this.normalizePath(filePath);
      this.checkBoundary(absolutePath);
      return true;
    } catch {
      return false;
    }
  }
}
