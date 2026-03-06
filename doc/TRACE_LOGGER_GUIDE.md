# Trace Logger Guide

## Обзор

`TraceLogger` — это система детального логирования для отслеживания выполнения инструментов в flow tool execute. Она обеспечивает полную видимость всех этапов выполнения инструментов, включая валидацию, выполнение, ошибки и состояние.

## Архитектура

### Основные компоненты

1. **TraceLogger** (`src/tools/TraceLogger.ts`)
   - Основной класс для логирования
   - Хранит события трассировки в памяти
   - Поддерживает различные уровни логирования (TRACE, DEBUG, INFO, WARN, ERROR)

2. **ToolHandler** (`src/tools/ToolHandler.ts`)
   - Использует TraceLogger для отслеживания всех операций
   - Логирует фазы: APPROVAL_REQUEST, TOOL_EXECUTION, EXECUTE_AND_REPORT

3. **CommandExecutor** (`src/tools/CommandExecutor.ts`)
   - Логирует выполнение shell команд
   - Отслеживает валидацию, спавнинг процесса, вывод и выход

4. **FileSystemExecutor** (`src/tools/FileSystemExecutor.ts`)
   - Логирует операции с файлами (read_file, list_directory)
   - Отслеживает валидацию пути и результаты операций

## Интеграция

### ToolHandler

```typescript
import { TraceLogger } from './TraceLogger';

export class ToolHandler {
  private traceLogger: TraceLogger;

  constructor(...) {
    // Инициализация TraceLogger
    this.traceLogger = new TraceLogger('ToolHandler', {
      enableConsole: true,
      maxTraces: 2000
    });
  }

  async handleToolExecutionSignal(event: ToolExecutionSignal): Promise<void> {
    // Фаза начала
    this.traceLogger.phaseStart('TOOL_EXECUTION', {
      tool_id: event.tool_id,
      tool_type: event.tool_type
    });

    try {
      // Этап
      this.traceLogger.step('TOOL_EXECUTION', 'CHECK_PRECONDITIONS', {
        tool_id: event.tool_id
      });

      // Валидация
      const isApproved = /* check logic */;
      this.traceLogger.validation('approval_check', isApproved, 'Tool is approved');

      // Выполнение
      const result = await this.executeAndReport(event);

      // Инструмент завершился
      this.traceLogger.toolEnd(event.tool_id, event.tool_type, duration, success);
    } finally {
      // Фаза конца
      this.traceLogger.phaseEnd('TOOL_EXECUTION', duration, {
        tool_id: event.tool_id
      });
    }
  }
}
```

### CommandExecutor

```typescript
import { TraceLogger } from './TraceLogger';

export class CommandExecutor {
  private traceLogger: TraceLogger;

  constructor(options?: {}) {
    this.traceLogger = new TraceLogger('CommandExecutor', {
      enableConsole: true,
      maxTraces: 1000
    });
  }

  async executeCommand(params: Record<string, any>): Promise<ExecutorResult> {
    const startTime = Date.now();
    
    this.traceLogger.phaseStart('COMMAND_EXECUTION', {
      command: params.command,
      timeout: params.timeout
    });

    try {
      // Валидация параметров
      this.traceLogger.step('COMMAND_EXECUTION', 'VALIDATE_PARAMS', {});
      const validatedParams = ExecuteCommandParamsSchema.parse(params);
      this.traceLogger.validation('params_validation', true);

      // Валидация команды в whitelist
      this.traceLogger.step('COMMAND_EXECUTION', 'VALIDATE_WHITELIST', {});
      this.validateCommand(validatedParams.command);
      this.traceLogger.validation('whitelist_check', true, `Command is whitelisted`);

      // Выполнение с таймаутом
      this.traceLogger.step('COMMAND_EXECUTION', 'EXECUTE_WITH_TIMEOUT', {});
      const result = await this.executeWithTimeout(validatedParams.command, validatedParams.args);

      // Успешное завершение
      this.traceLogger.trace('COMMAND_SUCCESS', {
        exitCode: result.exit_code,
        stdoutSize: result.stdout.length,
        stderrSize: result.stderr.length
      });

      return { success: result.exit_code === 0, ...result };
    } catch (error) {
      this.traceLogger.error('Command execution failed', {
        command: params.command
      }, error instanceof Error ? error : undefined);
      return { success: false, error: String(error) };
    } finally {
      this.traceLogger.phaseEnd('COMMAND_EXECUTION', Date.now() - startTime, {
        command: params.command
      });
    }
  }

  private executeWithTimeout(command: string, args: string[]): Promise<Result> {
    const startTime = Date.now();
    
    this.traceLogger.phaseStart('EXECUTE_WITH_TIMEOUT', {
      command,
      argsCount: args.length
    });

    return new Promise((resolve, reject) => {
      // Спавнинг процесса
      this.traceLogger.step('EXECUTE_WITH_TIMEOUT', 'SPAWN_PROCESS', { command });
      const child = spawn(command, args);
      this.traceLogger.trace('PROCESS_SPAWNED', { pid: child.pid });

      let stdout = '';
      let stdoutChunks = 0;

      // Обработка вывода
      child.stdout?.on('data', (data: Buffer) => {
        stdoutChunks++;
        stdout += data.toString();
        this.traceLogger.trace('STDOUT_CHUNK', {
          chunkNumber: stdoutChunks,
          chunkSize: data.length,
          totalSize: stdout.length
        });
      });

      // Обработка выхода
      child.on('exit', (code, signal) => {
        this.traceLogger.trace('PROCESS_EXIT', {
          exitCode: code,
          signal,
          duration: Date.now() - startTime,
          stdoutChunks
        });

        this.traceLogger.phaseEnd('EXECUTE_WITH_TIMEOUT', Date.now() - startTime, {
          command,
          exitCode: code
        });

        resolve({ stdout, stderr: '', exit_code: code || 0 });
      });

      // Обработка ошибок
      child.on('error', (error) => {
        this.traceLogger.error('Process error', { command }, error);
        reject(error);
      });
    });
  }
}
```

### FileSystemExecutor

```typescript
import { TraceLogger } from './TraceLogger';

export class FileSystemExecutor {
  private traceLogger: TraceLogger;

  constructor(workspaceRoot: string, options?: {}) {
    this.traceLogger = new TraceLogger('FileSystemExecutor', {
      enableConsole: true,
      maxTraces: 1000
    });
  }

  async readFile(params: Record<string, any>): Promise<ExecutorResult> {
    const startTime = Date.now();
    
    this.traceLogger.phaseStart('READ_FILE', {
      path: params.path,
      encoding: params.encoding || 'utf-8'
    });

    try {
      // Валидация параметров
      this.traceLogger.step('READ_FILE', 'VALIDATE_PARAMS', {});
      const validatedParams = ReadFileParamsSchema.parse(params);
      this.traceLogger.validation('params_validation', true);

      // Валидация пути
      this.traceLogger.step('READ_FILE', 'VALIDATE_PATH', {});
      const absolutePath = this.pathValidator.validateReadPath(validatedParams.path, {
        checkWorkspaceBoundary: true,
        checkExists: true
      });
      this.traceLogger.validation('path_validation', true, `Path: ${absolutePath}`);

      // Чтение файла
      this.traceLogger.step('READ_FILE', 'READ_FILE_CONTENT', {});
      const content = fs.readFileSync(absolutePath, validatedParams.encoding as BufferEncoding);
      const stats = fs.statSync(absolutePath);

      this.traceLogger.trace('FILE_READ_SUCCESS', {
        path: validatedParams.path,
        size: stats.size,
        duration: Date.now() - startTime
      });

      return { success: true, output: content, size_bytes: stats.size };
    } catch (error) {
      this.traceLogger.error('Failed to read file', {
        path: params.path
      }, error instanceof Error ? error : undefined);
      return { success: false, error: String(error) };
    } finally {
      this.traceLogger.phaseEnd('READ_FILE', Date.now() - startTime, {
        path: params.path
      });
    }
  }
}
```

## API TraceLogger

### Основные методы

#### Логирование по уровням

```typescript
// TRACE уровень (наиболее подробный)
traceLogger.trace('Сообщение', context?: TraceContext);

// DEBUG уровень
traceLogger.debug('Сообщение', context?: TraceContext);

// INFO уровень
traceLogger.info('Сообщение', context?: TraceContext);

// WARN уровень
traceLogger.warn('Сообщение', context?: TraceContext);

// ERROR уровень (с опциональным Error объектом)
traceLogger.error('Сообщение', context?: TraceContext, error?: Error);
```

#### Управление фазами

```typescript
// Начало фазы
traceLogger.phaseStart('PHASE_NAME', context?: TraceContext);

// Конец фазы с продолжительностью в миллисекундах
traceLogger.phaseEnd('PHASE_NAME', duration_ms: number, context?: TraceContext);
```

#### Этапы внутри фазы

```typescript
// Логирование этапа в рамках фазы
traceLogger.step('PHASE_NAME', 'STEP_NAME', context?: TraceContext);
```

#### Валидация

```typescript
// Логирование результата валидации
traceLogger.validation(step: string, valid: boolean, reason?: string, context?: TraceContext);
```

#### Специализированные методы

```typescript
// Запуск инструмента
traceLogger.toolStart(tool_id: string, tool_type: string, context?: TraceContext);

// Завершение инструмента
traceLogger.toolEnd(tool_id: string, tool_type: string, duration_ms: number, success: boolean, context?: TraceContext);

// Запрос на одобрение
traceLogger.approvalStart(tool_id: string, tool_name: string, risk_level: string, context?: TraceContext);

// Ответ на запрос одобрения
traceLogger.approvalEnd(tool_id: string, approved: boolean, reason?: string, context?: TraceContext);

// Логирование параметров (с автоматическим скрытием чувствительных данных)
traceLogger.params(phase: string, params: Record<string, any>);

// Логирование состояния
traceLogger.state(phase: string, state: Record<string, any>);
```

### Получение данных трассировки

```typescript
// Получить все события трассировки
const allTraces: TraceEvent[] = traceLogger.getTraces();

// Получить события для конкретного инструмента
const toolTraces: TraceEvent[] = traceLogger.getToolTraces(tool_id: string);

// Получить отчёт для инструмента
const report: string = traceLogger.getToolReport(tool_id: string);

// Экспортировать все события в JSON
const json: string = traceLogger.exportJSON();

// Очистить все события
traceLogger.clear();
```

## Использование в ToolHandler

### Получение TraceLogger из ToolHandler

```typescript
// В ChatViewProvider или других компонентах
const toolHandler: ToolHandler = /* получить экземпляр */;

// Получить TraceLogger
const traceLogger: TraceLogger = toolHandler.getTraceLogger();

// Получить отчёт для конкретного инструмента
const toolReport: string = toolHandler.exportToolTraces(tool_id);

// Получить все события в JSON
const allTraces: string = toolHandler.exportAllTraces();

// Получить историю выполнения
const history: ExecutionHistoryEntry[] = toolHandler.getExecutionHistory();

// Очистить события трассировки
toolHandler.clearTraces();
```

## Структура TraceEvent

```typescript
interface TraceEvent {
  level: TraceLevel;           // TRACE | DEBUG | INFO | WARN | ERROR
  timestamp: string;            // ISO 8601 timestamp
  message: string;              // Сообщение с префиксом класса [ClassName]
  context?: TraceContext;       // Дополнительный контекст
  stack?: string;               // Stack trace для ошибок
}

interface TraceContext {
  tool_id?: string;
  tool_type?: string;
  phase?: string;
  step?: string;
  duration_ms?: number;
  timestamp?: string;
  [key: string]: any;          // Другие поля контекста
}
```

## Примеры использования

### Пример 1: Отслеживание выполнения инструмента

```typescript
const traceLogger = new TraceLogger('MyExecutor');

async function executeToolWithTrace(toolId: string, toolType: string) {
  const startTime = Date.now();
  
  traceLogger.phaseStart('TOOL_EXECUTION', {
    tool_id: toolId,
    tool_type: toolType
  });

  try {
    // Проверка одобрения
    traceLogger.step('TOOL_EXECUTION', 'CHECK_APPROVAL', { tool_id: toolId });
    const isApproved = await checkApproval(toolId);
    traceLogger.validation('approval_check', isApproved, isApproved ? 'Approved' : 'Not approved');

    if (!isApproved) {
      traceLogger.trace('EXECUTION_REJECTED', { tool_id: toolId });
      return;
    }

    // Выполнение
    traceLogger.toolStart(toolId, toolType);
    const result = await execute(toolType);
    
    const duration = Date.now() - startTime;
    traceLogger.toolEnd(toolId, toolType, duration, result.success);

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    traceLogger.error('Execution failed', { tool_id: toolId }, error instanceof Error ? error : undefined);
    throw error;
  } finally {
    traceLogger.phaseEnd('TOOL_EXECUTION', Date.now() - startTime, {
      tool_id: toolId,
      completed: true
    });
  }
}

// Получить отчёт
const report = traceLogger.getToolReport(toolId);
console.log(report);
```

### Пример 2: Отслеживание команды с процессом

```typescript
const traceLogger = new TraceLogger('CommandExecutor');

async function executeCommandWithTrace(command: string, args: string[]) {
  const startTime = Date.now();
  
  traceLogger.phaseStart('COMMAND_EXECUTION', {
    command,
    argsCount: args.length
  });

  try {
    // Валидация
    traceLogger.step('COMMAND_EXECUTION', 'VALIDATE_COMMAND', { command });
    validateWhitelist(command);
    traceLogger.validation('whitelist_check', true, 'Command is whitelisted');

    // Спавнинг процесса
    traceLogger.step('COMMAND_EXECUTION', 'SPAWN_PROCESS', { command });
    const child = spawn(command, args);
    traceLogger.trace('PROCESS_SPAWNED', { pid: child.pid, command });

    let stdout = '';
    let chunks = 0;

    child.stdout?.on('data', (data: Buffer) => {
      chunks++;
      stdout += data;
      traceLogger.trace('STDOUT_RECEIVED', {
        command,
        chunkNumber: chunks,
        chunkSize: data.length,
        totalSize: stdout.length
      });
    });

    return new Promise((resolve, reject) => {
      child.on('exit', (code) => {
        const duration = Date.now() - startTime;
        traceLogger.trace('PROCESS_EXITED', {
          command,
          exitCode: code,
          chunks,
          finalSize: stdout.length
        });
        traceLogger.phaseEnd('COMMAND_EXECUTION', duration, {
          command,
          success: code === 0
        });
        resolve({ stdout, exit_code: code || 0 });
      });

      child.on('error', (error) => {
        traceLogger.error('Process error', { command }, error);
        reject(error);
      });
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    traceLogger.error('Command execution failed', { command }, error instanceof Error ? error : undefined);
    traceLogger.phaseEnd('COMMAND_EXECUTION', duration, { command, success: false });
    throw error;
  }
}

// Получить все события
const allEvents = traceLogger.getTraces();
console.log(`Total trace events: ${allEvents.length}`);

// Экспортировать в JSON для сохранения/отправки
const json = traceLogger.exportJSON();
```

### Пример 3: Интеграция с UI для отладки

```typescript
// В компоненте React или WebView
const handleShowTrace = (toolId: string) => {
  // Получить TraceLogger из ToolHandler
  const traceLogger = toolHandler.getTraceLogger();
  
  // Получить отчёт
  const report = toolHandler.exportToolTraces(toolId);
  
  // Показать в модальном окне или сохранить
  showModal('Tool Execution Trace', report);
};

const handleExportAllTraces = () => {
  // Экспортировать все события в JSON
  const json = toolHandler.exportAllTraces();
  
  // Скачать как файл
  downloadFile('traces.json', json);
};

const handleClearTraces = () => {
  toolHandler.clearTraces();
};
```

## Безопасность

TraceLogger автоматически скрывает чувствительные данные:

- Параметры с названием содержащим `password`, `token`, `secret` -> `***REDACTED***`
- Длинные строки (>500 символов) -> усекаются и добавляется `(truncated)`

Пример:

```typescript
traceLogger.params('LOGIN_ATTEMPT', {
  username: 'user@example.com',
  password: '123456',        // -> '***REDACTED***'
  token: 'secret-token',     // -> '***REDACTED***'
  userData: 'very-long-data...' // -> 'very-long-data... (truncated)'
});
```

## Производительность

- **maxTraces**: По умолчанию 2000 событий (ToolHandler), 1000 (ExecutorDefaults)
  - Старые события удаляются при превышении лимита
  - Можно настроить при инициализации
- **enableConsole**: Логирование в консоль браузера/VS Code
  - По умолчанию `true` для отладки
  - Можно отключить для продакшена

```typescript
const traceLogger = new TraceLogger('MyService', {
  maxTraces: 5000,      // Увеличить буфер
  enableConsole: false  // Отключить консоль в продакшене
});
```

## Отладка

Для отладки flow tool execute:

1. **Открыть DevTools** (F12 в VS Code Webview)
2. **Получить TraceLogger**:
   ```javascript
   // В консоли JS
   const traces = window.toolHandler.getTraceLogger().getTraces();
   console.log(JSON.stringify(traces, null, 2));
   ```
3. **Экспортировать отчёт**:
   ```javascript
   const report = window.toolHandler.exportAllTraces();
   console.log(report);
   ```
4. **Фильтровать по инструменту**:
   ```javascript
   const toolTraces = window.toolHandler.getTraceLogger().getToolTraces('tool-id-123');
   console.log(JSON.stringify(toolTraces, null, 2));
   ```
