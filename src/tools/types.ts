/**
 * Tool Execution Types and Interfaces
 * Полная типизация для tool flow MVP
 */

// Tool Names (только MVP tools: read_file + execute_command)
export type ToolName = 'read_file' | 'execute_command';

// Risk Levels для tool execution
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

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

// Tool Approval Request Event (от сервера)
export interface ToolApprovalRequestEvent {
  approval_id: string;
  tool_name: ToolName;
  tool_params: Record<string, any>;
  risk_level: RiskLevel;
  timeout_seconds: number;
  description: string;  // human-readable description
}

// Tool Execution Signal Event (от сервера)
export interface ToolExecutionSignalEvent {
  tool_id: string;
  tool_name: ToolName;
  tool_params: Record<string, any>;
}

// Tool Result ACK Event (от сервера, optional)
export interface ToolResultAckEvent {
  tool_id: string;
  status: 'received' | 'processing' | 'completed';
}

// Tool Executor Interface
export interface IToolExecutor {
  execute(toolName: ToolName, params: Record<string, any>): Promise<ToolExecutionResult>;
}

// Tool Execution Result (результат выполнения инструмента)
export interface ToolExecutionResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  output?: string;
  error?: string;
  duration_ms?: number;
}

// File Operations Result (для read_file)
export interface FileReadResult extends ToolExecutionResult {
  success: boolean;
  output?: string;       // file contents
  error?: string;        // if failed
  size_bytes?: number;
  encoding?: string;
}

// Command Execution Result (для execute_command)
export interface CommandExecutionResult extends ToolExecutionResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  error?: string;
  signal?: string;       // SIGTERM, SIGKILL и т.д.
  duration_ms?: number;
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
