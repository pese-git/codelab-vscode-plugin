import { z } from 'zod';

export class APIError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class NetworkError extends Error {
  constructor(
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public zodError: z.ZodError
  ) {
    super(`${message}: ${zodError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    this.name = 'ValidationError';
  }
  
  getDetails(): string {
    return JSON.stringify(this.zodError.errors, null, 2);
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Не retry на client errors (4xx) и ValidationError
      if (error instanceof APIError && error.status >= 400 && error.status < 500) {
        throw error;
      }
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      if (attempt < maxAttempts - 1) {
        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        await new Promise<void>(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // Пробрасываем оригинальную ошибку вместо создания новой
  throw lastError || new Error('Unknown error after retry');
}
