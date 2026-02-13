import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APIClient } from '../client';
import { APIError } from '../errors';
import type * as vscode from 'vscode';

describe('APIClient', () => {
  let client: APIClient;
  let mockContext: any;
  
  beforeEach(() => {
    mockContext = {
      secrets: {
        get: vi.fn().mockResolvedValue('test-token'),
        store: vi.fn(),
        delete: vi.fn()
      }
    };
    client = new APIClient(mockContext as vscode.ExtensionContext);
  });
  
  it('should create session', async () => {
    const mockSessionId = '550e8400-e29b-41d4-a716-446655440000';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: mockSessionId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }) as any;
    
    const session = await client.createSession();
    expect(session.id).toBe(mockSessionId);
  });
  
  it('should handle 401 error', async () => {
    mockContext.secrets.get.mockResolvedValue(null);
    
    await expect(client.createSession()).rejects.toThrow(APIError);
  });
  
  it('should validate response with Zod', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ invalid: 'data' })
    }) as any;
    
    await expect(client.createSession()).rejects.toThrow();
  });
});
