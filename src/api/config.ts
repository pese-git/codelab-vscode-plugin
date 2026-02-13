import * as vscode from 'vscode';
import { z } from 'zod';

const APIConfigSchema = z.object({
  baseUrl: z.string().url(),
  timeout: z.number().positive(),
  retryAttempts: z.number().int().min(1).max(10),
  streamingEnabled: z.boolean()
});

export type APIConfig = z.infer<typeof APIConfigSchema>;

export function getAPIConfig(): APIConfig {
  const config = vscode.workspace.getConfiguration('codelab.api');
  
  const rawConfig = {
    baseUrl: config.get('baseUrl', 'http://localhost:8000'),
    timeout: config.get('timeout', 30000),
    retryAttempts: config.get('retryAttempts', 3),
    streamingEnabled: config.get('streamingEnabled', true)
  };
  
  return APIConfigSchema.parse(rawConfig);
}
