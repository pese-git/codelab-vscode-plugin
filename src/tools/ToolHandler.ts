/**
 * Tool Handler
 * Главный оркестратор для обработки tool событий от backend
 * Согласно OpenSpec: local-tool-execution/spec.md
 */

import { CodeLabAPI } from '../api';
import { FileSystemExecutor } from './FileSystemExecutor';
import { CommandExecutor } from './CommandExecutor';
import { PathValidator } from './PathValidator';
import { TraceLogger } from './TraceLogger';
import { TraceDebugger } from './TraceDebugger';
import {
  ToolApprovalRequest,
  ToolExecutionSignal,
  ToolResultAck,
  ToolExecutionResult,
  ToolName,
  RiskLevel
} from './types';

export interface IApprovalDialogProvider {
  showApprovalDialog(
    event: ToolApprovalRequest,
    onApprove: () => void,
    onReject: (reason?: string) => void
  ): void;
}

export interface Logger {
  info(message: string): void;
  debug(message: string): void;
  error(message: string): void;
}

export interface ToolHandlerConfig {
  commandTimeoutMs?: number;
  fileSizeMaxBytes?: number;
  concurrencyLimit?: number;
  approvalTimeoutMs?: number;
  enableCaching?: boolean;
  cacheTtlMs?: number;
}

interface PendingApprovalState {
  request: ToolApprovalRequest;
  timeout: NodeJS.Timeout;
  resolver: (approved: boolean) => void;
}

interface ActiveExecutionState {
  signal: ToolExecutionSignal;
  timeout: NodeJS.Timeout;
  startTime: Date;
}

interface ExecutionHistoryEntry {
  tool_id: string;
  tool_type: ToolName;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  duration_ms?: number;
  error?: string;
  user_approved?: boolean;
  risk_level?: RiskLevel;
}

interface QueuedExecution {
  event: ToolExecutionSignal;
  resolver: (result: ToolExecutionResult) => void;
}

export class ToolHandler {
  private fileSystemExecutor: FileSystemExecutor;
  private commandExecutor: CommandExecutor;
  // @ts-expect-error - pathValidator reserved for future path validation features
  private pathValidator: PathValidator;
  private traceLogger: TraceLogger;

  private pendingApprovals: Map<string, PendingApprovalState> = new Map();
  private activeExecutions: Map<string, ActiveExecutionState> = new Map();
  private executionHistory: ExecutionHistoryEntry[] = [];
  private concurrentCount: number = 0;
  private concurrentQueue: QueuedExecution[] = [];

  private readonly DEFAULT_CONFIG: Required<ToolHandlerConfig> = {
    commandTimeoutMs: 300000, // 5 minutes
    fileSizeMaxBytes: 100 * 1024 * 1024, // 100MB
    concurrencyLimit: 3,
    approvalTimeoutMs: 300000, // 5 minutes
    enableCaching: true,
    cacheTtlMs: 300000 // 5 minutes
  };

  constructor(
    private api: CodeLabAPI,
    private dialogProvider: IApprovalDialogProvider,
    private logger: Logger,
    private workspacePath: string,
    config?: ToolHandlerConfig
  ) {
    this.config = { ...this.DEFAULT_CONFIG, ...config };

    // Initialize trace logger
    this.traceLogger = new TraceLogger('ToolHandler', {
      enableConsole: true,
      maxTraces: 2000
    });

    // Initialize executors
    this.pathValidator = new PathValidator(this.workspacePath);
    this.fileSystemExecutor = new FileSystemExecutor(this.workspacePath, {
      maxFileSize: this.config.fileSizeMaxBytes,
      enableLogging: true
    });
    this.commandExecutor = new CommandExecutor({
      timeout: this.config.commandTimeoutMs,
      enableLogging: true
    });

    this.logger.info('ToolHandler initialized');
    this.traceLogger.info('ToolHandler initialized', {
      workspacePath: this.workspacePath,
      config: this.config
    });
  }

  private config: Required<ToolHandlerConfig>;

  /**
   * Handle tool approval request from backend
   * Спецификация: local-tool-execution/spec.md:39-61
   */
  async handleToolApprovalRequest(event: ToolApprovalRequest): Promise<void> {
    this.traceLogger.phaseStart('APPROVAL_REQUEST', {
      tool_id: event.tool_id,
      tool_name: event.tool_name,
      risk_level: event.risk_level
    });

    this.logger.info(`Tool approval request received: ${event.tool_id}, ${event.tool_name}, risk_level=${event.risk_level}`);

    try {
      // Validate event
      this.traceLogger.step('APPROVAL_REQUEST', 'VALIDATE_EVENT', {
        tool_id: event.tool_id
      });

      if (this.pendingApprovals.has(event.tool_id)) {
        this.logger.error(`Duplicate approval request: ${event.tool_id}`);
        this.traceLogger.validation('duplicate_approval_check', false, 'Duplicate approval request');
        return;
      }

      this.traceLogger.validation('duplicate_approval_check', true);
      this.traceLogger.approvalStart(event.tool_id, event.tool_name, event.risk_level);

      // Request user approval
      this.traceLogger.step('APPROVAL_REQUEST', 'REQUEST_USER_APPROVAL', {
        tool_id: event.tool_id
      });

      const approved = await this.requestUserApproval(event);

      this.traceLogger.approvalEnd(event.tool_id, approved, approved ? 'User approved' : 'User declined');

      // Send approval/rejection to backend
      if (approved) {
        this.traceLogger.step('APPROVAL_REQUEST', 'SEND_APPROVAL', {
          tool_id: event.tool_id
        });

        this.logger.info(`Tool approved by user: ${event.tool_id}`);
        await this.api.approveToolExecution(event.tool_id);

        this.traceLogger.trace('APPROVAL_SENT', {
          tool_id: event.tool_id,
          status: 'approved'
        });
      } else {
        this.traceLogger.step('APPROVAL_REQUEST', 'SEND_REJECTION', {
          tool_id: event.tool_id
        });

        this.logger.info(`Tool rejected by user: ${event.tool_id}`);
        await this.api.rejectToolExecution(event.tool_id, 'User declined');

        this.traceLogger.trace('REJECTION_SENT', {
          tool_id: event.tool_id,
          status: 'rejected'
        });
      }
    } catch (error) {
      this.logger.error(`Error handling tool approval request: ${error instanceof Error ? error.message : String(error)}`);
      this.traceLogger.error('Error handling tool approval request', {
        tool_id: event.tool_id
      }, error instanceof Error ? error : undefined);
    }

    this.traceLogger.phaseEnd('APPROVAL_REQUEST', Date.now(), {
      tool_id: event.tool_id
    });
  }

  /**
   * Handle tool execution signal from backend
   * Спецификация: local-tool-execution/spec.md:63-84
   */
  async handleToolExecutionSignal(event: ToolExecutionSignal | any): Promise<void> {
    const startTime = Date.now();

    // Unpack payload if event is wrapped (from StreamingClient)
    const unwrappedEvent = (event.payload || event) as ToolExecutionSignal;

    // Normalize event: support both old and new field names
    const tool_id = unwrappedEvent.tool_id || event.tool_id;
    const tool_name = unwrappedEvent.tool_name || unwrappedEvent.tool_type as any;
    const tool_params = unwrappedEvent.tool_params || unwrappedEvent.args || {};

    this.traceLogger.phaseStart('TOOL_EXECUTION', {
      tool_id,
      tool_type: tool_name
    });

    this.logger.info(`[ToolHandler] ════════════════════════════════════════`);
    this.logger.info(`[ToolHandler] Tool execution signal received`);
    this.logger.info(`[ToolHandler] Tool ID: ${tool_id}`);
    this.logger.info(`[ToolHandler] Tool Name: ${tool_name}`);
    this.logger.info(`[ToolHandler] Parameters: ${JSON.stringify(tool_params)}`);
    this.logger.info(`[ToolHandler] ════════════════════════════════════════`);

    try {
      // Check preconditions
      this.traceLogger.step('TOOL_EXECUTION', 'CHECK_PRECONDITIONS', {
        tool_id,
        tool_type: tool_name
      });

      const isApproved = unwrappedEvent.execution_context?.user_approved || this.pendingApprovals.has(tool_id);
      this.traceLogger.state('PRECONDITIONS_CHECK', {
        tool_id,
        isApproved,
        userApproved: unwrappedEvent.execution_context?.user_approved,
        pendingApproval: this.pendingApprovals.has(tool_id),
        toolType: tool_name,
        requiresApproval: tool_name !== 'read_file' && tool_name !== 'list_directory'
      });

      if (!isApproved && tool_name !== 'read_file' && tool_name !== 'list_directory') {
        this.logger.error(`Tool execution not approved: ${tool_id}`);
        this.traceLogger.validation('approval_check', false, 'Tool execution not approved');
        return;
      }

      this.traceLogger.validation('approval_check', true);

      // Check concurrency
      this.traceLogger.step('TOOL_EXECUTION', 'CHECK_CONCURRENCY', {
        tool_id,
        concurrentCount: this.concurrentCount,
        concurrencyLimit: this.config.concurrencyLimit,
        queueLength: this.concurrentQueue.length
      });

      if (this.concurrentCount >= this.config.concurrencyLimit) {
        this.logger.info(`Queueing tool execution (concurrent limit reached): ${tool_id}`);
        this.traceLogger.trace('TOOL_QUEUED', {
          tool_id,
          reason: 'concurrent_limit_reached',
          queueLength: this.concurrentQueue.length + 1
        });

        // Queue execution
        await new Promise<ToolExecutionResult>((resolver) => {
          this.concurrentQueue.push({ event, resolver });
        });
        return;
      }

      // Execute and report result
      this.traceLogger.step('TOOL_EXECUTION', 'EXECUTE_AND_REPORT', {
        tool_id,
        tool_type: tool_name
      });

      // Create normalized event to ensure tool_id and tool_name are always available
      const normalizedEvent: ToolExecutionSignal = {
        ...event,
        tool_id,
        tool_name,
        tool_type: tool_name as any
      };

      const result = await this.executeAndReport(normalizedEvent);

      this.logger.info(`[ToolHandler] Tool execution completed`);
      this.logger.info(`[ToolHandler] Status: ${result.status}`);
      this.logger.info(`[ToolHandler] Duration: ${result.duration_ms}ms`);

      this.traceLogger.trace('EXECUTION_RESULT', {
        tool_id,
        status: result.status,
        duration_ms: result.duration_ms
      });

      // Send result to backend
      this.traceLogger.step('TOOL_EXECUTION', 'SEND_RESULT_TO_BACKEND', {
        tool_id
      });

      this.logger.info(`[ToolHandler] About to send result for tool: ${tool_id}`);
      
      try {
        await this.api.sendToolResult(tool_id, result);
        this.logger.info(`[ToolHandler] Result sent successfully to backend`);
      } catch (sendError) {
        const errorMessage = sendError instanceof Error ? sendError.message : String(sendError);
        this.logger.error(`[ToolHandler] Failed to send result to backend for tool ${tool_id}: ${errorMessage}`);
        this.traceLogger.error('Failed to send tool result', {
          tool_id
        }, sendError instanceof Error ? sendError : undefined);
        throw sendError;
      }

      this.traceLogger.trace('RESULT_SENT', {
        tool_id,
        status: 'sent'
      });

      // Cleanup
      this.traceLogger.step('TOOL_EXECUTION', 'CLEANUP', {
        tool_id
      });

      this.pendingApprovals.delete(tool_id);
      this.activeExecutions.delete(tool_id);

      // Process queued executions
      this.traceLogger.step('TOOL_EXECUTION', 'PROCESS_QUEUE', {
        tool_id,
        queueLength: this.concurrentQueue.length
      });

      this.processQueuedExecutions();
    } catch (error) {
      this.logger.error(`Error handling tool execution signal: ${error instanceof Error ? error.message : String(error)}`);
      this.traceLogger.error('Error handling tool execution signal', {
        tool_id
      }, error instanceof Error ? error : undefined);
    }

    this.traceLogger.phaseEnd('TOOL_EXECUTION', Date.now() - startTime, {
      tool_id
    });
  }

  /**
   * Handle tool result ack from backend
   * Спецификация: local-tool-execution/spec.md:85-98
   */
  handleToolResultAck(event: ToolResultAck): void {
    this.traceLogger.phaseStart('RESULT_ACK', {
      tool_id: event.tool_id,
      receipt_status: event.receipt_status
    });

    this.logger.info(`Tool result ack received: ${event.tool_id}, ${event.receipt_status}`);

    try {
      // Update state
      this.traceLogger.step('RESULT_ACK', 'UPDATE_STATE', {
        tool_id: event.tool_id
      });

      this.activeExecutions.delete(event.tool_id);

      this.traceLogger.state('RESULT_ACK_STATE', {
        tool_id: event.tool_id,
        receipt_status: event.receipt_status,
        activeExecutionsCount: this.activeExecutions.size
      });

      if (event.receipt_status === 'rejected' && event.message) {
        this.logger.error(`Tool result rejected: ${event.tool_id}, message: ${event.message}`);
        this.traceLogger.validation('result_ack_status', false, `Rejected: ${event.message}`);
      } else {
        this.traceLogger.validation('result_ack_status', true, `Status: ${event.receipt_status}`);
      }
    } catch (error) {
      this.logger.error(`Error handling tool result ack: ${error instanceof Error ? error.message : String(error)}`);
      this.traceLogger.error('Error handling tool result ack', {
        tool_id: event.tool_id
      }, error instanceof Error ? error : undefined);
    }

    this.traceLogger.phaseEnd('RESULT_ACK', Date.now(), {
      tool_id: event.tool_id
    });
  }

  /**
   * Request user approval for tool execution
   * Спецификация: local-tool-execution/spec.md:99-125
   */
  private requestUserApproval(event: ToolApprovalRequest, timeout: number = this.config.approvalTimeoutMs): Promise<boolean> {
    const startTime = Date.now();

    this.traceLogger.phaseStart('USER_APPROVAL_REQUEST', {
      tool_id: event.tool_id,
      tool_name: event.tool_name,
      timeout
    });

    return new Promise((resolve) => {
      const timeoutHandle = setTimeout(() => {
        this.logger.info(`Approval timeout for tool: ${event.tool_id}`);
        this.traceLogger.trace('APPROVAL_TIMEOUT', {
          tool_id: event.tool_id,
          timeoutMs: Date.now() - startTime
        });

        this.pendingApprovals.delete(event.tool_id);
        this.traceLogger.phaseEnd('USER_APPROVAL_REQUEST', Date.now() - startTime, {
          tool_id: event.tool_id,
          result: 'timeout'
        });

        resolve(false); // Auto-reject on timeout
      }, timeout);

      const onApprove = () => {
        this.traceLogger.trace('USER_APPROVED', {
          tool_id: event.tool_id,
          timeToApprovalMs: Date.now() - startTime
        });

        clearTimeout(timeoutHandle);
        this.pendingApprovals.delete(event.tool_id);
        this.traceLogger.phaseEnd('USER_APPROVAL_REQUEST', Date.now() - startTime, {
          tool_id: event.tool_id,
          result: 'approved'
        });

        resolve(true);
      };

      const onReject = (reason?: string) => {
        this.traceLogger.trace('USER_REJECTED', {
          tool_id: event.tool_id,
          reason: reason || 'User declined',
          timeToRejectionMs: Date.now() - startTime
        });

        clearTimeout(timeoutHandle);
        this.pendingApprovals.delete(event.tool_id);
        this.logger.info(`Tool rejected: ${event.tool_id}, reason: ${reason || 'User declined'}`);
        this.traceLogger.phaseEnd('USER_APPROVAL_REQUEST', Date.now() - startTime, {
          tool_id: event.tool_id,
          result: 'rejected',
          reason
        });

        resolve(false);
      };

      // Store approval state
      this.traceLogger.step('USER_APPROVAL_REQUEST', 'STORE_STATE', {
        tool_id: event.tool_id
      });

      this.pendingApprovals.set(event.tool_id, {
        request: event,
        timeout: timeoutHandle,
        resolver: resolve
      });

      // Show dialog
      this.traceLogger.step('USER_APPROVAL_REQUEST', 'SHOW_DIALOG', {
        tool_id: event.tool_id,
        tool_name: event.tool_name,
        risk_level: event.risk_level
      });

      this.dialogProvider.showApprovalDialog(event, onApprove, onReject);

      this.traceLogger.trace('DIALOG_SHOWN', {
        tool_id: event.tool_id,
        timeoutMs: timeout
      });
    });
  }

  /**
   * Execute tool and report result
   * Спецификация: local-tool-execution/spec.md:127-155
   */
  private async executeAndReport(event: ToolExecutionSignal): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    this.concurrentCount++;

    // Normalize event fields (support both old and new field names)
    const tool_name = event.tool_name || (event.tool_type as any) || 'unknown';
    const tool_params = event.tool_params || event.args || {};

    this.traceLogger.phaseStart('EXECUTE_AND_REPORT', {
      tool_id: event.tool_id,
      tool_type: tool_name,
      concurrentCount: this.concurrentCount
    });

    try {
      this.logger.info(`Executing tool: ${event.tool_id}, type: ${tool_name}`);

      this.traceLogger.toolStart(event.tool_id, tool_name, {
        concurrentCount: this.concurrentCount
      });

      this.traceLogger.params('EXECUTOR_INPUT', tool_params);

      let executorResult: any;

      // Delegate to appropriate executor
      this.traceLogger.step('EXECUTE_AND_REPORT', 'DELEGATE_TO_EXECUTOR', {
        tool_id: event.tool_id,
        tool_type: tool_name
      });

      switch (tool_name) {
        case 'read_file':
          this.logger.info(`[ToolHandler] ▶️  Executing read_file`);
          this.logger.info(`[ToolHandler] Path: ${tool_params?.path || 'N/A'}`);
          this.traceLogger.trace('EXECUTING_READ_FILE', {
            tool_id: event.tool_id,
            args: tool_params
          });
          executorResult = await this.fileSystemExecutor.readFile(tool_params);
          if (executorResult.success) {
            const outputPreview = executorResult.output 
              ? (typeof executorResult.output === 'string' 
                  ? executorResult.output.substring(0, 100) 
                  : JSON.stringify(executorResult.output).substring(0, 100))
              : 'N/A';
            this.logger.info(`[ToolHandler] ✅ read_file succeeded`);
            this.logger.info(`[ToolHandler] File size: ${executorResult.size_bytes || 0} bytes`);
            this.logger.info(`[ToolHandler] Content preview: ${outputPreview}...`);
          } else {
            this.logger.info(`[ToolHandler] ❌ read_file failed`);
            this.logger.info(`[ToolHandler] Error: ${executorResult.error || 'Unknown error'}`);
          }
          break;

        case 'write_file':
          this.traceLogger.trace('EXECUTING_WRITE_FILE', {
            tool_id: event.tool_id,
            args: tool_params
          });
          // Not yet implemented in FileSystemExecutor
          executorResult = {
            success: false,
            error: 'write_file not yet implemented'
          };
          break;

        case 'list_directory':
          this.traceLogger.trace('EXECUTING_LIST_DIRECTORY', {
            tool_id: event.tool_id,
            args: tool_params
          });
          executorResult = await this.fileSystemExecutor.listDirectory(tool_params);
          break;

        case 'execute_command':
          this.traceLogger.trace('EXECUTING_COMMAND', {
            tool_id: event.tool_id,
            args: tool_params
          });
          executorResult = await this.commandExecutor.executeCommand(tool_params);
          break;

        default:
          this.traceLogger.trace('UNKNOWN_TOOL_TYPE', {
            tool_id: event.tool_id,
            tool_type: tool_name
          });
          executorResult = {
            success: false,
            error: `Unknown tool type: ${tool_name}`
          };
      }

      const duration_ms = Date.now() - startTime;
      const success = executorResult?.success === true;

      this.traceLogger.trace('EXECUTOR_RESULT', {
        tool_id: event.tool_id,
        success,
        duration_ms,
        hasOutput: !!executorResult?.output,
        hasError: !!executorResult?.error,
        exitCode: executorResult?.exit_code
      });

      // Log execution
      this.traceLogger.step('EXECUTE_AND_REPORT', 'UPDATE_EXECUTION_HISTORY', {
        tool_id: event.tool_id,
        status: success ? 'completed' : 'failed'
      });

      this.executionHistory.push({
        tool_id: event.tool_id,
        tool_type: tool_name as any,
        status: success ? 'completed' : 'failed',
        startTime: new Date(startTime),
        endTime: new Date(),
        duration_ms,
        error: executorResult?.error
      });

      this.logger.info(`Tool execution completed: ${event.tool_id}, duration: ${duration_ms}ms`);

      this.traceLogger.toolEnd(event.tool_id, tool_name, duration_ms, success, {
        executionHistorySize: this.executionHistory.length
      });

      // Create execution result
      this.traceLogger.step('EXECUTE_AND_REPORT', 'CREATE_RESULT', {
        tool_id: event.tool_id,
        status: success ? 'success' : 'error'
      });

      const executionResult: ToolExecutionResult = {
        tool_id: event.tool_id,
        tool_type: tool_name as any,
        status: success ? 'success' : 'error',
        output: success ? (executorResult.output || undefined) : undefined,
        error: success ? undefined : {
          message: executorResult?.error || 'Unknown error',
          code: 'EXECUTION_ERROR'
        },
        duration_ms,
        timestamp: new Date().toISOString(),
        stdout: executorResult?.stdout,
        stderr: executorResult?.stderr,
        exit_code: executorResult?.exit_code
      };

      this.traceLogger.trace('RESULT_CREATED', {
        tool_id: event.tool_id,
        status: executionResult.status,
        hasOutput: !!executionResult.output,
        hasError: !!executionResult.error
      });

      return executionResult;
    } catch (error) {
      const duration_ms = Date.now() - startTime;

      this.logger.error(`Tool execution error: ${event.tool_id}, error: ${error instanceof Error ? error.message : String(error)}`);

      this.traceLogger.error('Tool execution error', {
        tool_id: event.tool_id,
        duration_ms
      }, error instanceof Error ? error : undefined);

      const errorResult = {
        tool_id: event.tool_id,
        tool_type: tool_name as any,
        status: 'error' as const,
        output: undefined,
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'EXECUTION_ERROR'
        },
        duration_ms,
        timestamp: new Date().toISOString()
      };

      this.traceLogger.trace('ERROR_RESULT_CREATED', {
        tool_id: event.tool_id,
        errorMessage: errorResult.error.message,
        duration_ms
      });

      return errorResult;
    } finally {
      this.concurrentCount--;
      this.traceLogger.phaseEnd('EXECUTE_AND_REPORT', Date.now() - startTime, {
        tool_id: event.tool_id,
        concurrentCount: this.concurrentCount
      });
    }
  }

  /**
   * Process queued executions
   */
  private processQueuedExecutions(): void {
    this.traceLogger.phaseStart('PROCESS_QUEUED_EXECUTIONS', {
      queueLength: this.concurrentQueue.length,
      concurrentCount: this.concurrentCount,
      concurrencyLimit: this.config.concurrencyLimit
    });

    const startTime = Date.now();
    let processed = 0;

    while (this.concurrentQueue.length > 0 && this.concurrentCount < this.config.concurrencyLimit) {
      const { event, resolver } = this.concurrentQueue.shift()!;

      // Normalize event fields
      const tool_id = event.tool_id;
      const tool_name = event.tool_name || (event.tool_type as any) || 'unknown';

      this.traceLogger.trace('PROCESSING_QUEUED_EXECUTION', {
        tool_id,
        tool_type: tool_name,
        queueLengthAfter: this.concurrentQueue.length
      });

      processed++;

      // Ensure normalized event has correct fields
      const normalizedEvent: ToolExecutionSignal = {
        ...event,
        tool_id,
        tool_name,
        tool_type: tool_name as any
      };

      this.executeAndReport(normalizedEvent)
        .then((result) => {
          this.traceLogger.trace('QUEUED_EXECUTION_RESOLVED', {
            tool_id,
            status: result.status
          });
          resolver(result);
        })
        .catch((error) => {
          this.traceLogger.error('QUEUED_EXECUTION_ERROR', {
            tool_id
          }, error instanceof Error ? error : undefined);
        });
    }

    this.traceLogger.phaseEnd('PROCESS_QUEUED_EXECUTIONS', Date.now() - startTime, {
      processedCount: processed,
      remainingQueueLength: this.concurrentQueue.length
    });
  }

  /**
   * Get trace logger for debugging
   */
  getTraceLogger(): TraceLogger {
    return this.traceLogger;
  }

  /**
   * Get trace debugger for analysis
   */
  getTraceDebugger(): TraceDebugger {
    return new TraceDebugger(this.traceLogger);
  }

  /**
   * Get execution history
   */
  getExecutionHistory(): ExecutionHistoryEntry[] {
    return [...this.executionHistory];
  }

  /**
   * Export traces for tool
   */
  exportToolTraces(tool_id: string): string {
    return this.traceLogger.getToolReport(tool_id);
  }

  /**
   * Export all traces
   */
  exportAllTraces(): string {
    return this.traceLogger.exportJSON();
  }

  /**
   * Export detailed analysis report
   */
  exportDetailedReport(tool_id?: string): string {
    const traceDebugger = this.getTraceDebugger();
    return traceDebugger.exportDetailedJSON(tool_id);
  }

  /**
   * Get ASCII trace report
   */
  getTraceReport(tool_id?: string): string {
    const traceDebugger = this.getTraceDebugger();
    return traceDebugger.generateASCIIReport(tool_id);
  }

  /**
   * Get tool health status
   */
  getToolHealthStatus(tool_id: string): { healthy: boolean; score: number; issues: string[] } {
    const traceDebugger = this.getTraceDebugger();
    return traceDebugger.getToolHealth(tool_id);
  }

  /**
   * Clear all traces
   */
  clearTraces(): void {
    this.traceLogger.clear();
  }

  /**
   * Dispose and cleanup resources
   * Спецификация: local-tool-execution/spec.md:330-351
   */
  dispose(): void {
    this.traceLogger.phaseStart('DISPOSE', {
      pendingApprovalsCount: this.pendingApprovals.size,
      activeExecutionsCount: this.activeExecutions.size,
      queueLength: this.concurrentQueue.length,
      executionHistorySize: this.executionHistory.length
    });

    this.logger.info('ToolHandler disposing...');
    this.traceLogger.info('ToolHandler disposing', {
      state: {
        pendingApprovalsCount: this.pendingApprovals.size,
        activeExecutionsCount: this.activeExecutions.size,
        queueLength: this.concurrentQueue.length,
        executionHistorySize: this.executionHistory.length
      }
    });

    // Cancel all pending approvals
    this.traceLogger.step('DISPOSE', 'CANCEL_PENDING_APPROVALS', {
      count: this.pendingApprovals.size
    });

    for (const [toolId, approval] of this.pendingApprovals) {
      clearTimeout(approval.timeout);
      approval.resolver(false);
      this.traceLogger.trace('APPROVAL_CANCELLED', { tool_id: toolId });
    }
    this.pendingApprovals.clear();

    // Cancel all active executions
    this.traceLogger.step('DISPOSE', 'CANCEL_ACTIVE_EXECUTIONS', {
      count: this.activeExecutions.size
    });

    for (const [toolId, execution] of this.activeExecutions) {
      clearTimeout(execution.timeout);
      this.traceLogger.trace('EXECUTION_CANCELLED', { tool_id: toolId });
    }
    this.activeExecutions.clear();

    // Clear queued executions
    this.traceLogger.step('DISPOSE', 'CLEAR_QUEUE', {
      count: this.concurrentQueue.length
    });

    this.concurrentQueue = [];

    this.logger.info('ToolHandler disposed');
    this.traceLogger.phaseEnd('DISPOSE', Date.now(), {
      state: 'disposed'
    });
  }
}
