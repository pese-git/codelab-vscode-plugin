/**
 * Trace Console Formatter
 * Форматирует trace события для красивого вывода в console
 */

import { TraceEvent, TraceLevel } from './TraceLogger';

export interface ConsoleFormatterOptions {
  colorize?: boolean;
  showTimestamp?: boolean;
  showContext?: boolean;
  showDuration?: boolean;
  indentLevel?: number;
  maxMessageLength?: number;
}

export class TraceConsoleFormatter {
  private options: Required<ConsoleFormatterOptions>;

  constructor(options?: ConsoleFormatterOptions) {
    this.options = {
      colorize: true,
      showTimestamp: true,
      showContext: true,
      showDuration: true,
      indentLevel: 0,
      maxMessageLength: 100,
      ...options
    };
  }

  /**
   * Форматировать событие для вывода в консоль
   */
  formatEvent(event: TraceEvent): string {
    const parts: string[] = [];

    // Временная метка
    if (this.options.showTimestamp) {
      const time = new Date(event.timestamp).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
      });
      parts.push(this.colorize(time, 'gray'));
    }

    // Иконка уровня
    const icon = this.getLevelIcon(event.level);
    parts.push(icon);

    // Уровень
    const levelStr = event.level.padEnd(5);
    parts.push(this.colorize(levelStr, this.getLevelColor(event.level)));

    // Сообщение
    let message = event.message;
    if (message.length > this.options.maxMessageLength) {
      message = message.substring(0, this.options.maxMessageLength) + '…';
    }
    parts.push(message);

    // Продолжительность
    if (this.options.showDuration && event.context?.duration_ms) {
      const duration = `(${event.context.duration_ms}ms)`;
      parts.push(this.colorize(duration, 'cyan'));
    }

    let result = parts.join(' ');

    // Контекст
    if (this.options.showContext && event.context) {
      const contextStr = this.formatContext(event.context);
      if (contextStr) {
        result += '\n' + this.indent(contextStr, this.options.indentLevel + 2);
      }
    }

    // Stack trace для ошибок
    if (event.stack) {
      result += '\n' + this.indent(this.colorize(event.stack, 'red'), this.options.indentLevel + 2);
    }

    return result;
  }

  /**
   * Форматировать контекст события
   */
  private formatContext(context: Record<string, any>): string {
    const lines: string[] = [];

    for (const [key, value] of Object.entries(context)) {
      const formattedValue = this.formatValue(value);
      lines.push(`${this.colorize(key + ':', 'yellow')} ${formattedValue}`);
    }

    return lines.join('\n');
  }

  /**
   * Форматировать значение
   */
  private formatValue(value: any): string {
    if (value === null) {
      return this.colorize('null', 'gray');
    }
    if (value === undefined) {
      return this.colorize('undefined', 'gray');
    }
    if (typeof value === 'boolean') {
      return this.colorize(String(value), value ? 'green' : 'red');
    }
    if (typeof value === 'number') {
      return this.colorize(String(value), 'cyan');
    }
    if (typeof value === 'string') {
      // Скрыть чувствительные данные
      if (value === '***REDACTED***') {
        return this.colorize(value, 'red');
      }
      return `"${value}"`;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  }

  /**
   * Получить иконку уровня
   */
  private getLevelIcon(level: TraceLevel): string {
    switch (level) {
      case 'TRACE':
        return '🔍';
      case 'DEBUG':
        return '🐛';
      case 'INFO':
        return 'ℹ️';
      case 'WARN':
        return '⚠️';
      case 'ERROR':
        return '❌';
      default:
        return '•';
    }
  }

  /**
   * Получить цвет для уровня
   */
  private getLevelColor(level: TraceLevel): string {
    switch (level) {
      case 'TRACE':
        return 'gray';
      case 'DEBUG':
        return 'blue';
      case 'INFO':
        return 'green';
      case 'WARN':
        return 'yellow';
      case 'ERROR':
        return 'red';
      default:
        return 'white';
    }
  }

  /**
   * Применить цвет (ANSI)
   */
  private colorize(text: string, color: string): string {
    if (!this.options.colorize) {
      return text;
    }

    const colors: Record<string, string> = {
      reset: '\x1b[0m',
      gray: '\x1b[90m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      cyan: '\x1b[36m',
      white: '\x1b[37m'
    };

    return `${colors[color] || ''}${text}${colors.reset}`;
  }

  /**
   * Добавить отступ
   */
  private indent(text: string, spaces: number): string {
    const indent = ' '.repeat(spaces);
    return text
      .split('\n')
      .map(line => indent + line)
      .join('\n');
  }

  /**
   * Форматировать таблицу событий
   */
  formatTable(events: TraceEvent[]): string {
    const headers = ['Time', 'Level', 'Message', 'Duration', 'Tool ID'];
    const rows = events.map(event => [
      new Date(event.timestamp).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      event.level,
      event.message.substring(0, 40),
      event.context?.duration_ms ? `${event.context.duration_ms}ms` : '-',
      event.context?.tool_id || '-'
    ]);

    return this.createTable(headers, rows);
  }

  /**
   * Создать ASCII таблицу
   */
  private createTable(headers: string[], rows: string[][]): string {
    const colWidths = headers.map((h, i) =>
      Math.max(h.length, ...rows.map(r => (r[i] || '').length))
    );

    const lines: string[] = [];

    // Header
    const headerRow = headers
      .map((h, i) => h.padEnd(colWidths[i]))
      .join(' | ');
    lines.push(headerRow);
    lines.push('-'.repeat(headerRow.length));

    // Rows
    for (const row of rows) {
      const rowStr = row.map((cell, i) => (cell || '').padEnd(colWidths[i])).join(' | ');
      lines.push(rowStr);
    }

    return lines.join('\n');
  }

  /**
   * Форматировать группу событий (для фазы)
   */
  formatPhaseGroup(phaseName: string, events: TraceEvent[], duration?: number): string {
    const lines: string[] = [];

    // Заголовок фазы
    const header = `╔ ${this.colorize(phaseName, 'cyan')} ${
      duration ? `(${duration}ms)` : ''
    }`;
    lines.push(header);

    // События
    for (const event of events) {
      const eventStr = this.formatEvent(event);
      lines.push('║ ' + eventStr.split('\n').join('\n║ '));
    }

    // Закрытие
    lines.push('╚═════════════════════════════════════════');

    return lines.join('\n');
  }
}

/**
 * Console logger с автоматическим форматированием
 */
export class TraceConsoleLogger {
  constructor(private formatter: TraceConsoleFormatter = new TraceConsoleFormatter()) {}

  /**
   * Вывести событие в консоль
   */
  log(event: TraceEvent): void {
    const formatted = this.formatter.formatEvent(event);

    // Выбрать подходящий метод console в зависимости от уровня
    switch (event.level) {
      case TraceLevel.ERROR:
        console.error(formatted);
        break;
      case TraceLevel.WARN:
        console.warn(formatted);
        break;
      case TraceLevel.DEBUG:
      case TraceLevel.TRACE:
        console.debug(formatted);
        break;
      case TraceLevel.INFO:
      default:
        console.log(formatted);
    }
  }

  /**
   * Вывести группу событий (фазу)
   */
  logPhase(phaseName: string, events: TraceEvent[], duration?: number): void {
    const formatted = this.formatter.formatPhaseGroup(phaseName, events, duration);
    console.log(formatted);
  }

  /**
   * Вывести таблицу событий
   */
  logTable(events: TraceEvent[]): void {
    const formatted = this.formatter.formatTable(events);
    console.log(formatted);
  }
}

/**
 * Создать консоль логгер
 */
export const createTraceConsoleLogger = (options?: ConsoleFormatterOptions): TraceConsoleLogger => {
  return new TraceConsoleLogger(new TraceConsoleFormatter(options));
};
