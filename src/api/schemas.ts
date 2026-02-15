import { z } from 'zod';

// Health
export const HealthResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  version: z.string(),
  timestamp: z.string().datetime()
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// Chat Session
export const ChatSessionResponseSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(), // API возвращает datetime без 'Z', используем string
  message_count: z.number().optional() // Опциональное поле
});

export type ChatSessionResponse = z.infer<typeof ChatSessionResponseSchema>;

export const SessionListResponseSchema = z.object({
  sessions: z.array(ChatSessionResponseSchema),
  total: z.number()
});

export type SessionListResponse = z.infer<typeof SessionListResponseSchema>;

// Message
export const MessageRequestSchema = z.object({
  content: z.string().min(1),
  target_agent: z.string().optional(), // Опциональное поле для прямого режима
  context: z.object({
    activeFile: z.object({
      path: z.string(),
      content: z.string(),
      languageId: z.string(),
      selection: z.object({
        start: z.object({ line: z.number(), character: z.number() }),
        end: z.object({ line: z.number(), character: z.number() }),
        text: z.string()
      }).optional()
    }).optional(),
    workspaceFiles: z.array(z.string()).optional(),
    diagnostics: z.array(z.object({
      file: z.string(),
      severity: z.enum(['error', 'warning', 'info']),
      message: z.string(),
      line: z.number(),
      character: z.number()
    })).optional()
  }).optional()
});

export type MessageRequest = z.infer<typeof MessageRequestSchema>;

export const MessageResponseSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  timestamp: z.string(), // API может возвращать datetime без 'Z'
  agent_id: z.string().uuid().nullable(), // API возвращает null, а не undefined
  diff: z.string().optional()
});

export type MessageResponse = z.infer<typeof MessageResponseSchema>;

export const MessageHistoryResponseSchema = z.object({
  messages: z.array(MessageResponseSchema),
  total: z.number(),
  session_id: z.string().uuid()
});

export type MessageHistoryResponse = z.infer<typeof MessageHistoryResponseSchema>;

// Stream Event
export const StreamEventSchema = z.object({
  event_type: z.enum([
    'task_started',
    'task_progress',
    'task_completed',
    'error',
    'heartbeat'
  ]),
  payload: z.any(),
  session_id: z.string().uuid(),
  timestamp: z.string().datetime()
});

export type StreamEvent = z.infer<typeof StreamEventSchema>;

// Agent
export const CreateAgentRequestSchema = z.object({
  name: z.string(),
  type: z.string(),
  config: z.record(z.any())
});

export type CreateAgentRequest = z.infer<typeof CreateAgentRequestSchema>;

export const AgentResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.string(),
  config: z.record(z.any()),
  created_at: z.string().datetime()
});

export type AgentResponse = z.infer<typeof AgentResponseSchema>;

export const AgentListResponseSchema = z.object({
  agents: z.array(AgentResponseSchema),
  total: z.number()
});

export type AgentListResponse = z.infer<typeof AgentListResponseSchema>;
