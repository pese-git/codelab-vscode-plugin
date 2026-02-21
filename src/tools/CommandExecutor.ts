/**
 * Command Executor
 * Выполняет shell команды с безопасностью, таймаутом и command whitelist
 */

import { spawn } from 'child_process';
import { CommandExecutionResult, ToolExecutionTimeoutError } from './types';
import { ExecuteCommandParamsSchema } from './schemas';

export class CommandExecutor {
  private readonly defaultTimeout: number;
  private readonly commandWhitelist: Set<string>;
  private readonly maxOutputSize: number;
  private readonly enableLogging: boolean;

  // Default whitelisted commands (MVP safe commands)
  private static readonly DEFAULT_WHITELIST = [
    'npm',
    'npx',
    'node',
    'git',
    'python',
    'python3',
    'pip',
    'pip3',
    'cat',
    'ls',
    'pwd',
    'echo',
    'grep',
    'sed',
    'find',
    'head',
    'tail',
    'wc',
    'sort',
    'uniq',
    'cut'
  ];

  constructor(options?: {
    timeout?: number;
    commandWhitelist?: string[];
    maxOutputSize?: number;
    enableLogging?: boolean;
  }) {
    this.defaultTimeout = options?.timeout || 300000; // 5 minutes
    this.maxOutputSize = options?.maxOutputSize || 10485760; // 10MB
    this.enableLogging = options?.enableLogging !== false;

    // Setup whitelist
    const whitelist = options?.commandWhitelist || CommandExecutor.DEFAULT_WHITELIST;
    this.commandWhitelist = new Set(whitelist.map(cmd => cmd.toLowerCase()));

    this.log(`[CommandExecutor] Initialized with ${this.commandWhitelist.size} whitelisted commands`);
  }

  /**
   * Execute shell command
   * @param params - { command: string, args?: string[], timeout?: number, cwd?: string }
   * @returns CommandExecutionResult with success/stdout/stderr/exit_code
   */
  async executeCommand(params: Record<string, any>): Promise<CommandExecutionResult> {
    const startTime = Date.now();

    try {
      // Validate parameters using Zod
      const validatedParams = ExecuteCommandParamsSchema.parse(params);
      const { command, args = [], timeout = this.defaultTimeout, cwd } = validatedParams;

      this.log(`[CommandExecutor] Executing: ${command} ${args.join(' ')}`);

      // Validate command is whitelisted
      this.validateCommand(command);

      // Execute command
      const result = await this.executeWithTimeout(command, args, cwd, timeout);

      const duration = Date.now() - startTime;

      this.log(
        `[CommandExecutor] Command completed (exit: ${result.exit_code}, ${duration}ms)`
      );

      return {
        success: result.exit_code === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        exit_code: result.exit_code,
        duration_ms: duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = this.getErrorMessage(error);

      this.log(`[CommandExecutor] Error: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
        duration_ms: duration
      };
    }
  }

  /**
   * Execute command with timeout protection
   */
  private executeWithTimeout(
    command: string,
    args: string[],
    cwd?: string,
    timeout?: number
  ): Promise<{ stdout: string; stderr: string; exit_code: number }> {
    return new Promise((resolve, reject) => {
      let killed = false;

      // Setup timeout
      const timeoutHandle = setTimeout(() => {
        killed = true;
        child.kill('SIGTERM');

        // If SIGTERM doesn't work, use SIGKILL
        setTimeout(() => {
          if (!killed) {
            child.kill('SIGKILL');
          }
        }, 5000); // Give 5 seconds for SIGTERM to work
      }, timeout || this.defaultTimeout);

      // Spawn process
      const child = spawn(command, args, {
        cwd,
        timeout: timeout || this.defaultTimeout
      });

      let stdout = '';
      let stderr = '';

      // Handle stdout
      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();

        // Check output size limit
        if (stdout.length > this.maxOutputSize) {
          killed = true;
          child.kill('SIGTERM');
        }
      });

      // Handle stderr
      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();

        // Check output size limit
        if (stderr.length > this.maxOutputSize) {
          killed = true;
          child.kill('SIGTERM');
        }
      });

      // Handle process exit
      child.on('exit', (code, signal) => {
        clearTimeout(timeoutHandle);

        if (killed) {
          reject(
            new ToolExecutionTimeoutError(
              `Command timeout after ${timeout}ms (signal: ${signal})`,
              'execute_command'
            )
          );
        } else if (code === null) {
          reject(new Error(`Command killed with signal: ${signal}`));
        } else {
          resolve({
            stdout: stdout.slice(0, this.maxOutputSize),
            stderr: stderr.slice(0, this.maxOutputSize),
            exit_code: code
          });
        }
      });

      // Handle process error
      child.on('error', (error) => {
        clearTimeout(timeoutHandle);
        reject(error);
      });
    });
  }

  /**
   * Validate command is in whitelist
   */
  private validateCommand(command: string): void {
    // Extract base command (first part before space/pipe/redirect)
    const baseCommand = command.split(/[\s|<>]/)[0].toLowerCase();

    // Check if it's in whitelist
    if (!this.commandWhitelist.has(baseCommand)) {
      throw new Error(`Command '${baseCommand}' is not whitelisted. Allowed: ${Array.from(this.commandWhitelist).join(', ')}`);
    }
  }

  /**
   * Add command to whitelist
   */
  addToWhitelist(command: string): void {
    this.commandWhitelist.add(command.toLowerCase());
    this.log(`[CommandExecutor] Added '${command}' to whitelist`);
  }

  /**
   * Remove command from whitelist
   */
  removeFromWhitelist(command: string): void {
    this.commandWhitelist.delete(command.toLowerCase());
    this.log(`[CommandExecutor] Removed '${command}' from whitelist`);
  }

  /**
   * Get current whitelist
   */
  getWhitelist(): string[] {
    return Array.from(this.commandWhitelist);
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
