/**
 * Trace Logger
 * Обеспечивает детальное логирование всех этапов выполнения инструментов
 * для отладки и мониторинга flow tool execute
 */

import { TraceConsoleLogger, createTraceConsoleLogger } from './TraceConsoleFormatter';

export enum TraceLevel {
  TRACE = 'TRACE',
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export interface TraceContext {
  tool_id?: string;
  tool_type?: string;
  phase?: string;
  step?: string;
  duration_ms?: number;
  timestamp?: string;
  [key: string]: any;
}

export interface TraceEvent {
  level: TraceLevel;
  timestamp: string;
  message: string;
  context?: TraceContext;
  stack?: string;
}

export class TraceLogger {
  private traces: TraceEvent[] = [];
  private readonly maxTraces: number = 1000;
  private enableConsole: boolean = true;
  private enableConsoleFormatter: boolean = true;
  private onTrace?: (event: TraceEvent) => void;
  private consoleLogger?: TraceConsoleLogger;

  constructor(
    private name: string,
    options?: {
      maxTraces?: number;
      enableConsole?: boolean;
      enableConsoleFormatter?: boolean;
      onTrace?: (event: TraceEvent) => void;
    }
  ) {
    this.maxTraces = options?.maxTraces || 1000;
    this.enableConsole = options?.enableConsole !== false;
    this.enableConsoleFormatter = options?.enableConsoleFormatter !== false;
    this.onTrace = options?.onTrace;

    // Инициализировать консольный логгер
    if (this.enableConsole && this.enableConsoleFormatter) {
      this.consoleLogger = createTraceConsoleLogger({
        colorize: true,
        showTimestamp: true,
        showContext: true,
        showDuration: true
      });
    }
  }

  /**
   * Log trace message with context
   */
  trace(message: string, context?: TraceContext): void {
    this.log(TraceLevel.TRACE, message, context);
  }

  /**
   * Log debug message with context
   */
  debug(message: string, context?: TraceContext): void {
    this.log(TraceLevel.DEBUG, message, context);
  }

  /**
   * Log info message with context
   */
  info(message: string, context?: TraceContext): void {
    this.log(TraceLevel.INFO, message, context);
  }

  /**
   * Log warning message with context
   */
  warn(message: string, context?: TraceContext): void {
    this.log(TraceLevel.WARN, message, context);
  }

  /**
   * Log error message with context
   */
  error(message: string, context?: TraceContext, error?: Error): void {
    const event: TraceEvent = {
      level: TraceLevel.ERROR,
      timestamp: new Date().toISOString(),
      message: `[${this.name}] ${message}`,
      context,
      stack: error?.stack
    };

    this.addTrace(event);
    if (this.enableConsole) {
      if (this.consoleLogger) {
        this.consoleLogger.log(event);
      } else {
        console.error(`${event.timestamp} ${event.message}`, { context, stack: error?.stack });
      }
    }
    if (this.onTrace) {
      this.onTrace(event);
    }
  }

  /**
   * Log phase start
   */
  phaseStart(phase: string, context?: TraceContext): void {
    this.trace(`PHASE START: ${phase}`, { ...context, phase });
  }

  /**
   * Log phase end
   */
  phaseEnd(phase: string, duration_ms: number, context?: TraceContext): void {
    this.trace(`PHASE END: ${phase} (${duration_ms}ms)`, { ...context, phase, duration_ms });
  }

  /**
   * Log step execution
   */
  step(phase: string, step: string, context?: TraceContext): void {
    this.trace(`STEP: ${phase} -> ${step}`, { ...context, phase, step });
  }

  /**
   * Log tool execution start
   */
  toolStart(tool_id: string, tool_type: string, context?: TraceContext): void {
    this.trace('TOOL EXECUTION START', {
      tool_id,
      tool_type,
      ...context
    });
  }

  /**
   * Log tool execution end
   */
  toolEnd(tool_id: string, tool_type: string, duration_ms: number, success: boolean, context?: TraceContext): void {
    this.trace('TOOL EXECUTION END', {
      tool_id,
      tool_type,
      duration_ms,
      success,
      ...context
    });
  }

  /**
   * Log approval request
   */
  approvalStart(tool_id: string, tool_name: string, risk_level: string, context?: TraceContext): void {
    this.trace('APPROVAL REQUEST START', {
      tool_id,
      tool_name,
      risk_level,
      ...context
    });
  }

  /**
   * Log approval response
   */
  approvalEnd(tool_id: string, approved: boolean, reason?: string, context?: TraceContext): void {
    this.trace('APPROVAL REQUEST END', {
      tool_id,
      approved,
      reason,
      ...context
    });
  }

  /**
   * Log validation
   */
  validation(step: string, valid: boolean, reason?: string, context?: TraceContext): void {
    this.trace(`VALIDATION: ${step} - ${valid ? 'PASSED' : 'FAILED'}${reason ? ': ' + reason : ''}`, context);
  }

  /**
   * Log parameter details
   */
  params(phase: string, params: Record<string, any>): void {
    this.trace(`PARAMS: ${phase}`, {
      phase,
      ...this.sanitizeParams(params)
    });
  }

  /**
   * Log state information
   */
  state(phase: string, state: Record<string, any>): void {
    this.trace(`STATE: ${phase}`, {
      phase,
      ...state
    });
  }

  /**
   * Get all traces
   */
  getTraces(): TraceEvent[] {
    return [...this.traces];
  }

  /**
   * Get traces for specific tool
   */
  getToolTraces(tool_id: string): TraceEvent[] {
    return this.traces.filter(t => t.context?.tool_id === tool_id);
  }

  /**
   * Clear traces
   */
  clear(): void {
    this.traces = [];
  }

  /**
   * Export traces as JSON
   */
  exportJSON(): string {
    return JSON.stringify(this.traces, null, 2);
  }

  /**
   * Get trace report for tool
   */
  getToolReport(tool_id: string): string {
    const toolTraces = this.getToolTraces(tool_id);
    const lines = [
      `=== Tool Execution Report: ${tool_id} ===`,
      `Total events: ${toolTraces.length}`,
      ''
    ];

    for (const trace of toolTraces) {
      lines.push(`[${trace.level}] ${trace.timestamp}`);
      lines.push(`  Message: ${trace.message}`);
      if (trace.context) {
        lines.push(`  Context: ${JSON.stringify(trace.context)}`);
      }
      if (trace.stack) {
        lines.push(`  Stack: ${trace.stack}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Private methods
   */
  private log(level: TraceLevel, message: string, context?: TraceContext): void {
    const event: TraceEvent = {
      level,
      timestamp: new Date().toISOString(),
      message: `[${this.name}] ${message}`,
      context
    };

    this.addTrace(event);

    if (this.enableConsole) {
      if (this.consoleLogger) {
        // Красивый форматированный вывод
        this.consoleLogger.log(event);
      } else {
        // Обычный вывод (если форматер отключен)
        const logFn = level === TraceLevel.ERROR ? console.error : level === TraceLevel.WARN ? console.warn : level === TraceLevel.DEBUG ? console.debug : console.log;
        logFn(`${event.timestamp} ${event.message}`, context);
      }
    }

    if (this.onTrace) {
      this.onTrace(event);
    }
  }

  private addTrace(event: TraceEvent): void {
    this.traces.push(event);
    if (this.traces.length > this.maxTraces) {
      this.traces = this.traces.slice(-this.maxTraces);
    }
  }

  private sanitizeParams(params: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(params)) {
      if (key.toLowerCase().includes('password') || key.toLowerCase().includes('token') || key.toLowerCase().includes('secret')) {
        sanitized[key] = '***REDACTED***';
      } else if (typeof value === 'string' && value.length > 500) {
        sanitized[key] = value.substring(0, 500) + '... (truncated)';
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
}

/**
 * Global trace logger instance
 */
export const createTraceLogger = (name: string, options?: { maxTraces?: number; enableConsole?: boolean; onTrace?: (event: TraceEvent) => void }): TraceLogger => {
  return new TraceLogger(name, options);
};
