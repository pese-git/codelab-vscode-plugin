/**
 * Tool Execution Types and Interfaces
 * Полная типизация для tool flow согласно OpenSpec
 */

// Tool Names (поддерживаемые tools)
export type ToolName = 'read_file' | 'write_file' | 'execute_command' | 'list_directory';
export type ToolType = ToolName;

// Risk Levels для tool execution (согласно OpenSpec)
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

// Tool Execution Status
export type ToolExecutionStatus = 
  | 'PENDING'           // Параметры валидированы, риск оценен
  | 'AWAITING_APPROVAL' // Ожидание одобрения пользователя
  | 'APPROVED'          // Одобрено, готово к выполнению
  | 'EXECUTING'         // Выполняется на клиенте
  | 'COMPLETED'         // Успешно завершено
  | 'FAILED'            // Ошибка
  | 'REJECTED'          // Отклонено пользователем
  | 'TIMEOUT';          // Истёк таймаут ожидания

// Tool Execution Record
export interface ToolExecution {
  id: string;           // UUID
  tool_name: ToolName;
  tool_params: Record<string, any>;
  status: ToolExecutionStatus;
  risk_level: RiskLevel;
  created_at: string;   // ISO timestamp
  updated_at: string;   // ISO timestamp
  approval_timeout?: number; // milliseconds
  result?: {
    success: boolean;
    stdout?: string;
    stderr?: string;
    exit_code?: number;
    output?: string;     // для read_file
  };
  error?: string;       // error message если FAILED
}

// Tool Approval Request Event (от сервера, согласно OpenSpec)
export interface ToolApprovalRequest {
  type: 'tool.approval_request';
  tool_id: string;
  tool_name: ToolName;
  tool_description?: string;
  args: Record<string, unknown>;
  risk_level: RiskLevel;
  estimated_duration_ms?: number;
  timestamp: string;
  session_id?: string;
}

// Tool Execution Signal Event (от сервера, согласно OpenSpec)
export interface ToolExecutionSignal {
  type: 'tool.execution_signal';
  tool_id: string;
  tool_type: ToolType;
  args: Record<string, unknown>;
  execution_context?: {
    user_approved: boolean;
    approval_time?: string;
  };
  timestamp: string;
  session_id?: string;
}

// Tool Result ACK Event (от сервера, согласно OpenSpec)
export interface ToolResultAck {
  type: 'tool.result_ack';
  tool_id: string;
  receipt_status: 'received' | 'processed' | 'rejected';
  message?: string;
  timestamp: string;
  session_id?: string;
}

// Tool Executor Interface
export interface IToolExecutor {
  execute(toolName: ToolName, params: Record<string, any>): Promise<ToolExecutionResult>;
}

// Executor Result Types (для внутреннего использования executors)
export interface ExecutorResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  output?: string;
  error?: string;
  size_bytes?: number;
  encoding?: string;
  duration_ms?: number;
}

// File Operations Result (для read_file)
export type FileReadResult = ExecutorResult;

// Command Execution Result (для execute_command)
export type CommandExecutionResult = ExecutorResult;

// Tool Execution Result (для отправки на backend, согласно OpenSpec)
export interface ToolExecutionResult {
  tool_id: string;
  tool_type: ToolType;
  status: 'success' | 'error' | 'timeout' | 'cancelled';
  output?: unknown;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
  duration_ms: number;
  timestamp: string;
  stdout?: string;
  stderr?: string;
  exit_code?: number;
}

// Path Validation Options
export interface PathValidationOptions {
  checkWorkspaceBoundary?: boolean; // default: true
  checkExists?: boolean;             // default: false
  checkReadable?: boolean;           // default: true
  maxFileSize?: number;              // default: 100MB
}

// Tool Handler Configuration
export interface ToolHandlerConfig {
  workspaceRoot: string;
  maxConcurrentExecutions?: number; // default: 3
  commandTimeout?: number;          // default: 300000 (5 min)
  fileReadTimeout?: number;         // default: 30000 (30 sec)
  maxFileSize?: number;             // default: 104857600 (100MB)
  commandWhitelist?: string[];      // default: npm, git, node, python, etc.
  enableLogging?: boolean;          // default: true
}

// Approval Decision
export type ApprovalDecision = 'approved' | 'rejected' | 'timeout';

// Pending Approval State
export interface PendingApproval {
  approval_id: string;
  tool_name: ToolName;
  tool_params: Record<string, any>;
  risk_level: RiskLevel;
  requested_at: number;  // timestamp
  timeout_at: number;    // timestamp
  decision?: ApprovalDecision;
  decided_at?: number;   // timestamp
}

// Active Execution State
export interface ActiveExecution {
  tool_id: string;
  tool_name: ToolName;
  tool_params: Record<string, any>;
  started_at: number;    // timestamp
  result?: ToolExecutionResult;
  error?: string;
}

// Tool Handler State
export interface ToolHandlerState {
  pendingApprovals: Map<string, PendingApproval>;
  activeExecutions: Map<string, ActiveExecution>;
  executionQueue: string[];  // tool_ids в порядке очереди
}

// Error Types for Tool Execution
export class ToolExecutionError extends Error {
  constructor(
    message: string,
    public toolName: ToolName,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'ToolExecutionError';
  }
}

export class ToolValidationError extends ToolExecutionError {
  constructor(message: string, toolName: ToolName) {
    super(message, toolName, 'VALIDATION_ERROR', 400);
    this.name = 'ToolValidationError';
  }
}

export class ToolSecurityError extends ToolExecutionError {
  constructor(message: string, toolName: ToolName) {
    super(message, toolName, 'SECURITY_ERROR', 403);
    this.name = 'ToolSecurityError';
  }
}

export class ToolExecutionTimeoutError extends ToolExecutionError {
  constructor(message: string, toolName: ToolName) {
    super(message, toolName, 'TIMEOUT_ERROR', 504);
    this.name = 'ToolExecutionTimeoutError';
  }
}
