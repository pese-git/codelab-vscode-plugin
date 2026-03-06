/**
 * Command Executor
 * Выполняет shell команды с безопасностью, таймаутом и command whitelist
 */

import { spawn } from 'child_process';
import { ExecutorResult, ToolExecutionTimeoutError } from './types';
import { ExecuteCommandParamsSchema } from './schemas';
import { TraceLogger } from './TraceLogger';

export class CommandExecutor {
  private readonly defaultTimeout: number;
  private readonly commandWhitelist: Set<string>;
  private readonly maxOutputSize: number;
  private readonly enableLogging: boolean;
  private traceLogger: TraceLogger;

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

    // Initialize trace logger
    this.traceLogger = new TraceLogger('CommandExecutor', {
      enableConsole: this.enableLogging,
      maxTraces: 1000
    });

    // Setup whitelist
    const whitelist = options?.commandWhitelist || CommandExecutor.DEFAULT_WHITELIST;
    this.commandWhitelist = new Set(whitelist.map(cmd => cmd.toLowerCase()));

    this.log(`[CommandExecutor] Initialized with ${this.commandWhitelist.size} whitelisted commands`);
    this.traceLogger.info('CommandExecutor initialized', {
      timeout: this.defaultTimeout,
      whitelistSize: this.commandWhitelist.size,
      maxOutputSize: this.maxOutputSize
    });
  }

  /**
   * Execute shell command
   * @param params - { command: string, args?: string[], timeout?: number, cwd?: string }
   * @returns CommandExecutionResult with success/stdout/stderr/exit_code
   */
  async executeCommand(params: Record<string, any>): Promise<ExecutorResult> {
    const startTime = Date.now();

    this.traceLogger.phaseStart('COMMAND_EXECUTION', {
      command: params.command,
      hasArgs: !!params.args,
      argsCount: params.args?.length || 0,
      timeout: params.timeout,
      cwd: params.cwd
    });

    try {
      // Validate parameters using Zod
      this.traceLogger.step('COMMAND_EXECUTION', 'VALIDATE_PARAMS', {
        command: params.command
      });

      const validatedParams = ExecuteCommandParamsSchema.parse(params);
      const { command, args = [], timeout = this.defaultTimeout, cwd } = validatedParams;

      this.traceLogger.validation('params_validation', true);
      this.traceLogger.params('COMMAND_EXECUTION_INPUT', {
        command,
        argsCount: args.length,
        timeout,
        cwd
      });

      this.log(`[CommandExecutor] Executing: ${command} ${args.join(' ')}`);

      // Validate command is whitelisted
      this.traceLogger.step('COMMAND_EXECUTION', 'VALIDATE_WHITELIST', {
        command
      });

      this.validateCommand(command);
      this.traceLogger.validation('whitelist_check', true, `Command '${command}' is whitelisted`);

      // Execute command
      this.traceLogger.step('COMMAND_EXECUTION', 'EXECUTE_WITH_TIMEOUT', {
        command,
        timeout
      });

      const result = await this.executeWithTimeout(command, args, cwd, timeout);

      const duration = Date.now() - startTime;

      this.traceLogger.trace('COMMAND_OUTPUT', {
        command,
        exitCode: result.exit_code,
        stdoutSize: result.stdout.length,
        stderrSize: result.stderr.length,
        duration
      });

      this.log(
        `[CommandExecutor] Command completed (exit: ${result.exit_code}, ${duration}ms)`
      );

      const executionResult: ExecutorResult = {
        success: result.exit_code === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        exit_code: result.exit_code,
        duration_ms: duration
      };

      this.traceLogger.phaseEnd('COMMAND_EXECUTION', duration, {
        command,
        success: executionResult.success,
        exitCode: result.exit_code
      });

      return executionResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = this.getErrorMessage(error);

      this.log(`[CommandExecutor] Error: ${errorMessage}`);

      this.traceLogger.error('Command execution error', {
        command: params.command,
        duration
      }, error instanceof Error ? error : undefined);

      const errorResult: ExecutorResult = {
        success: false,
        error: errorMessage,
        duration_ms: duration
      };

      this.traceLogger.phaseEnd('COMMAND_EXECUTION', duration, {
        command: params.command,
        success: false,
        error: errorMessage
      });

      return errorResult;
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
    const startTime = Date.now();

    this.traceLogger.phaseStart('EXECUTE_WITH_TIMEOUT', {
      command,
      argsCount: args.length,
      timeout,
      cwd
    });

    return new Promise((resolve, reject) => {
      let killed = false;
      let stdoutChunks = 0;
      let stderrChunks = 0;

      // Setup timeout
      this.traceLogger.step('EXECUTE_WITH_TIMEOUT', 'SETUP_TIMEOUT', {
        command,
        timeout: timeout || this.defaultTimeout
      });

      const timeoutHandle = setTimeout(() => {
        killed = true;
        this.traceLogger.trace('TIMEOUT_TRIGGERED', {
          command,
          elapsedMs: Date.now() - startTime
        });

        child.kill('SIGTERM');

        // If SIGTERM doesn't work, use SIGKILL
        setTimeout(() => {
          if (!killed) {
            this.traceLogger.trace('SENDING_SIGKILL', {
              command
            });
            child.kill('SIGKILL');
          }
        }, 5000); // Give 5 seconds for SIGTERM to work
      }, timeout || this.defaultTimeout);

      // Spawn process
      this.traceLogger.step('EXECUTE_WITH_TIMEOUT', 'SPAWN_PROCESS', {
        command,
        args: args.length > 0 ? `${args.length} args` : 'no args'
      });

      const child = spawn(command, args, {
        cwd,
        timeout: timeout || this.defaultTimeout
      });

      this.traceLogger.trace('PROCESS_SPAWNED', {
        command,
        pid: child.pid
      });

      let stdout = '';
      let stderr = '';

      // Handle stdout
      child.stdout?.on('data', (data: Buffer) => {
        stdoutChunks++;
        const newSize = stdout.length + data.length;
        stdout += data.toString();

        this.traceLogger.trace('STDOUT_CHUNK', {
          command,
          chunkNumber: stdoutChunks,
          chunkSize: data.length,
          totalSize: newSize
        });

        // Check output size limit
        if (stdout.length > this.maxOutputSize) {
          killed = true;
          this.traceLogger.trace('STDOUT_SIZE_EXCEEDED', {
            command,
            maxSize: this.maxOutputSize,
            actualSize: stdout.length
          });
          child.kill('SIGTERM');
        }
      });

      // Handle stderr
      child.stderr?.on('data', (data: Buffer) => {
        stderrChunks++;
        const newSize = stderr.length + data.length;
        stderr += data.toString();

        this.traceLogger.trace('STDERR_CHUNK', {
          command,
          chunkNumber: stderrChunks,
          chunkSize: data.length,
          totalSize: newSize
        });

        // Check output size limit
        if (stderr.length > this.maxOutputSize) {
          killed = true;
          this.traceLogger.trace('STDERR_SIZE_EXCEEDED', {
            command,
            maxSize: this.maxOutputSize,
            actualSize: stderr.length
          });
          child.kill('SIGTERM');
        }
      });

      // Handle process exit
      child.on('exit', (code, signal) => {
        const exitTime = Date.now() - startTime;
        clearTimeout(timeoutHandle);

        this.traceLogger.trace('PROCESS_EXIT', {
          command,
          exitCode: code,
          signal,
          killed,
          elapsedMs: exitTime,
          stdoutChunks,
          stderrChunks,
          finalStdoutSize: stdout.length,
          finalStderrSize: stderr.length
        });

        if (killed) {
          this.traceLogger.error('COMMAND_TIMEOUT', {
            command,
            timeout: timeout || this.defaultTimeout,
            signal
          });

          reject(
            new ToolExecutionTimeoutError(
              `Command timeout after ${timeout}ms (signal: ${signal})`,
              'execute_command'
            )
          );
        } else if (code === null) {
          this.traceLogger.error('COMMAND_KILLED_BY_SIGNAL', {
            command,
            signal
          });

          reject(new Error(`Command killed with signal: ${signal}`));
        } else {
          this.traceLogger.trace('PROCESS_COMPLETED_SUCCESSFULLY', {
            command,
            exitCode: code,
            duration: exitTime
          });

          resolve({
            stdout: stdout.slice(0, this.maxOutputSize),
            stderr: stderr.slice(0, this.maxOutputSize),
            exit_code: code
          });
        }

        this.traceLogger.phaseEnd('EXECUTE_WITH_TIMEOUT', exitTime, {
          command,
          exitCode: code,
          signal,
          killed
        });
      });

      // Handle process error
      child.on('error', (error) => {
        clearTimeout(timeoutHandle);
        this.traceLogger.error('PROCESS_ERROR', {
          command
        }, error);

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
