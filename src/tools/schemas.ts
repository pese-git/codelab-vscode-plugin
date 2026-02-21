/**
 * Tool Execution Schemas
 * Zod schemas для runtime валидации tool parameters и events
 */

import { z } from 'zod';

// ==================== Tool Parameters ====================

/**
 * read_file parameters
 * Чтение содержимого файла
 */
export const ReadFileParamsSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  encoding: z.enum(['utf-8', 'ascii', 'binary']).default('utf-8').optional()
});

export type ReadFileParams = z.infer<typeof ReadFileParamsSchema>;

/**
 * execute_command parameters
 * Выполнение shell команды
 */
export const ExecuteCommandParamsSchema = z.object({
  command: z.string().min(1, 'Command is required'),
  args: z.array(z.string()).default([]).optional(),
  timeout: z.number().int().min(1000).max(600000).default(300000).optional(), // 1s - 10min, default 5min
  cwd: z.string().optional() // working directory
});

export type ExecuteCommandParams = z.infer<typeof ExecuteCommandParamsSchema>;

// ==================== Tool Results ====================

/**
 * read_file result
 */
export const FileReadResultSchema = z.object({
  success: z.boolean(),
  output: z.string().optional(),
  error: z.string().optional(),
  size_bytes: z.number().int().optional(),
  encoding: z.string().optional()
});

export type FileReadResult = z.infer<typeof FileReadResultSchema>;

/**
 * execute_command result
 */
export const CommandExecutionResultSchema = z.object({
  success: z.boolean(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  exit_code: z.number().int().optional(),
  error: z.string().optional(),
  signal: z.string().optional(),
  duration_ms: z.number().int().optional()
});

export type CommandExecutionResult = z.infer<typeof CommandExecutionResultSchema>;

// ==================== Tool Execution Events ====================

/**
 * tool_approval_request event (from Server)
 * Запрос одобрения для выполнения инструмента
 */
export const ToolApprovalRequestEventSchema = z.object({
  approval_id: z.string().uuid(),
  tool_name: z.enum(['read_file', 'execute_command']),
  tool_params: z.record(z.any()),
  risk_level: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  timeout_seconds: z.number().int().min(60).max(3600), // 1min - 1hour
  description: z.string().optional()
});

export type ToolApprovalRequestEvent = z.infer<typeof ToolApprovalRequestEventSchema>;

/**
 * tool_execution_signal event (from Server)
 * Сигнал к выполнению инструмента
 */
export const ToolExecutionSignalEventSchema = z.object({
  tool_id: z.string().uuid(),
  tool_name: z.enum(['read_file', 'execute_command']),
  tool_params: z.record(z.any())
});

export type ToolExecutionSignalEvent = z.infer<typeof ToolExecutionSignalEventSchema>;

/**
 * tool_result_ack event (from Server)
 * Подтверждение получения результата
 */
export const ToolResultAckEventSchema = z.object({
  tool_id: z.string().uuid(),
  status: z.enum(['received', 'processing', 'completed'])
});

export type ToolResultAckEvent = z.infer<typeof ToolResultAckEventSchema>;

// ==================== Tool Request/Response ====================

/**
 * Approve Tool Request (Client → Server)
 * Одобрение выполнения инструмента
 */
export const ApproveToolRequestSchema = z.object({
  approval_id: z.string().uuid(),
  decision: z.literal('approved').optional()
});

export type ApproveToolRequest = z.infer<typeof ApproveToolRequestSchema>;

/**
 * Reject Tool Request (Client → Server)
 * Отклонение выполнения инструмента
 */
export const RejectToolRequestSchema = z.object({
  approval_id: z.string().uuid(),
  reason: z.string().optional()
});

export type RejectToolRequest = z.infer<typeof RejectToolRequestSchema>;

/**
 * Submit Tool Result Request (Client → Server)
 * Отправка результата выполнения инструмента
 */
export const SubmitToolResultRequestSchema = z.object({
  tool_id: z.string().uuid(),
  status: z.enum(['completed', 'failed']),
  result: z.object({
    success: z.boolean(),
    stdout: z.string().optional(),
    stderr: z.string().optional(),
    exit_code: z.number().int().optional(),
    output: z.string().optional(),  // для read_file
    error: z.string().optional()
  }).optional(),
  error: z.string().optional()
});

export type SubmitToolResultRequest = z.infer<typeof SubmitToolResultRequestSchema>;

/**
 * Tool Result Response (Server → Client)
 * Ответ на отправку результата
 */
export const ToolResultResponseSchema = z.object({
  success: z.boolean(),
  tool_id: z.string().uuid(),
  status: z.enum(['completed', 'failed']),
  message: z.string().optional()
});

export type ToolResultResponse = z.infer<typeof ToolResultResponseSchema>;

// ==================== Validation Helper ====================

/**
 * Validate tool parameters
 * Валидирует параметры инструмента по его имени
 */
export function validateToolParams(
  toolName: 'read_file' | 'execute_command',
  params: Record<string, any>
): Record<string, any> {
  switch (toolName) {
    case 'read_file':
      return ReadFileParamsSchema.parse(params);
    case 'execute_command':
      return ExecuteCommandParamsSchema.parse(params);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
