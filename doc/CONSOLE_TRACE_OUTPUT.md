# Автоматический вывод Trace в Console

## Обзор

TraceLogger теперь автоматически выводит все события в браузерную консоль с красивым форматированием. Все трейсы отображаются в реальном времени с цветной подсветкой, иконками и структурированным контекстом.

## Активация

По умолчанию автоматический вывод **включен**. Трейсы будут выводиться в console при создании TraceLogger:

```typescript
// Автоматический вывод включен
const traceLogger = new TraceLogger('ToolHandler', {
  enableConsole: true,                // Общее логирование в console
  enableConsoleFormatter: true         // Красивое форматирование (по умолчанию)
});
```

## Отключение форматирования

Если нужен обычный вывод без форматирования:

```typescript
const traceLogger = new TraceLogger('CommandExecutor', {
  enableConsole: true,
  enableConsoleFormatter: false        // Отключить красивый форматер
});
```

Или полностью отключить вывод в консоль:

```typescript
const traceLogger = new TraceLogger('FileSystemExecutor', {
  enableConsole: false                 // Не выводить в console вообще
});
```

## Формат вывода

### Базовое событие

```
14:25:10.235 🔍 TRACE PHASE START: TOOL_EXECUTION (123ms)
  tool_id: "tool-123"
  tool_type: "execute_command"
```

Структура:
- **14:25:10.235** - Временная метка (HH:MM:SS.mmm)
- **🔍** - Иконка уровня (🔍=TRACE, 🐛=DEBUG, ℹ️=INFO, ⚠️=WARN, ❌=ERROR)
- **TRACE** - Уровень логирования (цветная подсветка)
- **Сообщение** - Основной текст события
- **(123ms)** - Продолжительность (если указана)
- **Контекст** - Дополнительные данные (с отступом)

### Типы событий

#### TRACE (обычный) 🔍
```
14:25:10.235 🔍 TRACE [ToolHandler] PHASE START: APPROVAL_REQUEST
  tool_id: "tool-abc"
  phase: "APPROVAL_REQUEST"
```

#### DEBUG 🐛
```
14:25:10.500 🐛 DEBUG [FileSystemExecutor] Reading file: /path/to/file.ts
  path: "/path/to/file.ts"
  encoding: "utf-8"
```

#### INFO ℹ️
```
14:25:10.750 ℹ️  INFO [CommandExecutor] Command completed (exit: 0, 245ms)
  command: "npm"
  exitCode: 0
  duration: 245
```

#### WARN ⚠️
```
14:25:11.000 ⚠️  WARN [ToolHandler] Tool result rejected
  tool_id: "tool-def"
  receipt_status: "rejected"
```

#### ERROR ❌
```
14:25:11.250 ❌ ERROR [CommandExecutor] Command execution failed
  command: "invalid-cmd"
  error: "ENOENT: no such file or directory"
```
Включает Stack Trace для отладки.

## Примеры в консоли VS Code

### Открыть Developer Tools

1. В VS Code Webview: **F12** или **Cmd+Option+I** (Mac)
2. Перейти на вкладку **Console**
3. Видеть все логи в реальном времени во время выполнения инструментов

### Фильтрация по уровню

Использовать встроенные фильтры консоли:

```javascript
// Показать только ошибки
// В console: выберите dropdown "All levels" → "Errors"

// Или в коде:
const traces = window.toolHandler.getTraceLogger().getTraces();
const errors = traces.filter(t => t.level === 'ERROR');
console.table(errors);
```

### Поиск по сообщению

Использовать фильтр консоли:
- Нажать Ctrl+F (или Cmd+F на Mac)
- Ввести текст для поиска: `VALIDATION`, `TIMEOUT`, `APPROVAL`

## Примеры вывода

### Полное выполнение инструмента

```
14:20:10.123 🔍 TRACE [ToolHandler] PHASE START: APPROVAL_REQUEST
  tool_id: "tool-001"
  tool_name: "read_file"
  risk_level: "low"

14:20:10.234 🔍 TRACE [ToolHandler] STEP: APPROVAL_REQUEST → VALIDATE_EVENT
  tool_id: "tool-001"

14:20:10.245 🔍 TRACE [ToolHandler] STEP: APPROVAL_REQUEST → REQUEST_USER_APPROVAL
  tool_id: "tool-001"

14:20:10.356 ℹ️  INFO [ToolHandler] DIALOG_SHOWN
  tool_id: "tool-001"
  toolName: "read_file"
  timeoutMs: 300000

14:20:10.567 🔍 TRACE [ToolHandler] USER_APPROVED
  tool_id: "tool-001"
  timeToApprovalMs: 211

14:20:10.678 ℹ️  INFO [ToolHandler] APPROVAL_SENT
  tool_id: "tool-001"
  status: "approved"

14:20:10.789 🔍 TRACE [ToolHandler] PHASE END: APPROVAL_REQUEST (666ms)
  tool_id: "tool-001"
```

### Выполнение команды

```
14:20:11.100 🔍 TRACE [CommandExecutor] PHASE START: COMMAND_EXECUTION
  command: "ls"
  argsCount: 1
  timeout: 300000

14:20:11.234 🔍 TRACE [CommandExecutor] PHASE START: EXECUTE_WITH_TIMEOUT
  command: "ls"
  argsCount: 1

14:20:11.345 🔍 TRACE [CommandExecutor] PROCESS_SPAWNED (11ms)
  command: "ls"
  pid: 12345

14:20:11.456 🔍 TRACE [CommandExecutor] STDOUT_CHUNK (111ms)
  command: "ls"
  chunkNumber: 1
  chunkSize: 256
  totalSize: 256

14:20:11.567 ℹ️  INFO [CommandExecutor] PROCESS_EXIT (222ms)
  command: "ls"
  exitCode: 0
  signal: null
  duration: 222
  stdoutChunks: 1
  finalSize: 256

14:20:11.678 🔍 TRACE [CommandExecutor] PROCESS_COMPLETED_SUCCESSFULLY (333ms)
  command: "ls"
  exitCode: 0
  duration: 333

14:20:11.789 🔍 TRACE [CommandExecutor] PHASE END: EXECUTE_WITH_TIMEOUT (444ms)
  command: "ls"
  exitCode: 0
```

### Ошибка при выполнении

```
14:20:12.100 🔍 TRACE [FileSystemExecutor] PHASE START: READ_FILE
  path: "./invalid-file.ts"
  encoding: "utf-8"

14:20:12.234 🔍 TRACE [FileSystemExecutor] VALIDATE_PATH
  path: "./invalid-file.ts"

14:20:12.345 ❌ ERROR [FileSystemExecutor] Error reading file
  path: "./invalid-file.ts"
  duration: 111
  Stack: Error: ENOENT: no such file or directory, open '/workspace/invalid-file.ts'
    at Object.openSync (fs.js:462:3)
    at Object.readFileSync (fs.js:364:45)
    ...

14:20:12.456 🔍 TRACE [FileSystemExecutor] PHASE END: READ_FILE (356ms)
  path: "./invalid-file.ts"
  success: false
  error: "ENOENT: no such file or directory"
```

## Отключение для продакшена

Для продакшена рекомендуется отключить console formatter, но оставить логирование:

```typescript
// В production среде
const isProduction = process.env.NODE_ENV === 'production';

const traceLogger = new TraceLogger('ToolHandler', {
  enableConsole: !isProduction,        // Отключить вывод в prod
  enableConsoleFormatter: true,         // (будет проигнорирован)
  maxTraces: isProduction ? 500 : 2000  // Меньший буфер в prod
});
```

Или только форматирование:

```typescript
const traceLogger = new TraceLogger('ToolHandler', {
  enableConsole: true,                  // Выводить в console
  enableConsoleFormatter: !isProduction // Форматер только в dev
});
```

## Производительность

### Impact на console

- **Минимальный** - форматирование происходит в реальном времени
- **Цветизация** использует ANSI коды (встроенная поддержка браузера)
- **Контекст** выводится структурированно для удобства

### Рекомендуемые настройки

| Сценарий | enableConsole | enableConsoleFormatter | maxTraces |
|----------|---|---|---|
| Local Dev | true | true | 2000 |
| CI/CD Logs | true | false | 1000 |
| Production | false | - | 500 |
| Debug Mode | true | true | 5000 |

## Передача на сервер

Можно автоматически отправлять логи на сервер:

```typescript
const traceLogger = new TraceLogger('ToolHandler', {
  enableConsole: true,
  onTrace: async (event) => {
    // Отправить на сервер
    if (event.level === 'ERROR' || event.level === 'WARN') {
      await fetch('/api/logs', {
        method: 'POST',
        body: JSON.stringify(event)
      });
    }
  }
});
```

## Интеграция с DevTools

### Экспортировать логи из DevTools

```javascript
// В консоли браузера
const json = window.toolHandler.exportAllTraces();
const blob = new Blob([json], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `traces-${new Date().getTime()}.json`;
a.click();
```

### Сохранить в localStorage

```javascript
// В консоли браузера
const json = window.toolHandler.exportAllTraces();
localStorage.setItem('tool_traces', json);

// Восстановить позже
const saved = localStorage.getItem('tool_traces');
const traces = JSON.parse(saved);
console.log(traces);
```

## Кастомизация формата

Для более точной кастомизации форматирования:

```typescript
import { TraceConsoleFormatter } from './tools/TraceConsoleFormatter';

const formatter = new TraceConsoleFormatter({
  colorize: true,              // Использовать цвета ANSI
  showTimestamp: true,         // Показывать время
  showContext: true,           // Показывать контекст
  showDuration: true,          // Показывать продолжительность
  indentLevel: 2,              // Отступ для контекста
  maxMessageLength: 100        // Макс длина сообщения
});

const event = traceLogger.getTraces()[0];
const formatted = formatter.formatEvent(event);
console.log(formatted);
```

## Полезные команды для console

```javascript
// Получить все события
window.toolHandler.getTraceLogger().getTraces()

// Вывести в таблицу
console.table(
  window.toolHandler.getTraceLogger().getTraces().map(t => ({
    Time: t.timestamp,
    Level: t.level,
    Message: t.message.substring(0, 50),
    Tool: t.context?.tool_id
  }))
)

// Получить только PHASE START/END
const phases = window.toolHandler.getTraceLogger().getTraces()
  .filter(t => t.message.includes('PHASE'));
console.table(phases);

// Получить статистику
const traces = window.toolHandler.getTraceLogger().getTraces();
const stats = {
  total: traces.length,
  errors: traces.filter(t => t.level === 'ERROR').length,
  warnings: traces.filter(t => t.level === 'WARN').length,
  duration: traces[traces.length - 1]?.context?.duration_ms
};
console.table(stats);

// Очистить логи
window.toolHandler.clearTraces()
```

## Видеть логи во время отладки

1. **Открыть DevTools**: F12
2. **Перейти на Console**: Вкладка "Console"
3. **Запустить инструмент**: Выполнить операцию в VS Code
4. **Наблюдать логи**: Все события выводятся в реальном времени
5. **Фильтровать**: Использовать поиск (Ctrl+F) или фильтры уровня

## Гарантии

- ✅ Все события логируются в консоль **автоматически**
- ✅ **Цветная подсветка** для разных уровней
- ✅ **Иконки** для быстрого визуального поиска
- ✅ **Структурированный контекст** для каждого события
- ✅ **Stack traces** для ошибок
- ✅ **Скрытие чувствительных данных** (пароли, токены)
- ✅ **Производительность** - минимальный overhead
- ✅ **Кастомизируемо** - все настраивается при инициализации
