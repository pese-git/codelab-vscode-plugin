import { z } from 'zod';

// Health
export const HealthResponseSchema = z.object({
  status: z.enum(['ok'])
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const ReadyResponseSchema = z.object({
  status: z.enum(['ready'])
});

export type ReadyResponse = z.infer<typeof ReadyResponseSchema>;

// Project
export const ProjectResponseSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  workspace_path: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string()
});

export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;

export const ProjectListResponseSchema = z.object({
  projects: z.array(ProjectResponseSchema),
  total: z.number()
});

export type ProjectListResponse = z.infer<typeof ProjectListResponseSchema>;

export const ProjectCreateSchema = z.object({
  name: z.string().min(1).max(255),
  workspace_path: z.string().max(500).optional()
});

export type ProjectCreate = z.infer<typeof ProjectCreateSchema>;

export const ProjectUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  workspace_path: z.string().max(500).nullable().optional()
});

export type ProjectUpdate = z.infer<typeof ProjectUpdateSchema>;

// Chat Session
export const ChatSessionResponseSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(),
  message_count: z.number()
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
  target_agent: z.string().optional()
});

export type MessageRequest = z.infer<typeof MessageRequestSchema>;

export const MessageResponseSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  timestamp: z.string(),
  agent_id: z.string().uuid().nullable()
});

export type MessageResponse = z.infer<typeof MessageResponseSchema>;

export const MessageListResponseSchema = z.object({
  messages: z.array(MessageResponseSchema),
  total: z.number(),
  session_id: z.string().uuid()
});

export type MessageListResponse = z.infer<typeof MessageListResponseSchema>;

// Stream Event
export const StreamEventSchema = z.object({
  type: z.enum([
    'message_received',
    'message_created',
    'agent_started',
    'agent_status_changed',
    'agent_response',
    'agent_completed',
    'orchestration_started',
    'orchestration_plan_created',
    'orchestration_completed',
    'heartbeat',
    'direct_agent_call',
    'task_started',
    'task_completed'
  ]).optional(),
  event_type: z.enum([
    'message_received',
    'message_created',
    'agent_started',
    'agent_status_changed',
    'agent_response',
    'agent_completed',
    'orchestration_started',
    'orchestration_plan_created',
    'orchestration_completed',
    'heartbeat',
    'direct_agent_call',
    'task_started',
    'task_completed'
  ]).optional(),
  agent_id: z.string().uuid().nullable().optional(),
  content: z.string().nullable().optional(),
  timestamp: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  payload: z.record(z.any()).optional(),
  session_id: z.string().optional()
}).transform(obj => {
  const eventType = obj.type || obj.event_type || 'unknown';
  return { ...obj, type: eventType as any };
});

export type StreamEvent = z.infer<typeof StreamEventSchema>;

// Agent
export const AgentConfigSchema = z.object({
  name: z.string().min(1).max(100),
  system_prompt: z.string().min(1),
  model: z.string().optional(),
  tools: z.array(z.string()).optional(),
  concurrency_limit: z.number().int().min(1).max(10).optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().min(1).max(128000).optional(),
  metadata: z.record(z.any()).optional()
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export const AgentResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: z.enum(['ready', 'busy', 'error']),
  created_at: z.string(),
  config: AgentConfigSchema
});

export type AgentResponse = z.infer<typeof AgentResponseSchema>;

export const AgentListResponseSchema = z.object({
  agents: z.array(AgentResponseSchema),
  total: z.number()
});

export type AgentListResponse = z.infer<typeof AgentListResponseSchema>;

export const AgentUpdateSchema = z.object({
  config: AgentConfigSchema
});

export type AgentUpdate = z.infer<typeof AgentUpdateSchema>;
