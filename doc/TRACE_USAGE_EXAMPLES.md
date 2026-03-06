# Примеры использования Trace Logger

## Быстрый старт

### Получение TraceLogger из ToolHandler

```typescript
// В вашем компоненте или сервисе
import { ToolHandler } from './tools/ToolHandler';

const toolHandler: ToolHandler = /* инициализация */;

// Получить TraceLogger
const traceLogger = toolHandler.getTraceLogger();

// Получить TraceDebugger для анализа
const traceDebugger = toolHandler.getTraceDebugger();
```

## Примеры 1: Просмотр логов в консоли

### Получить все события трассировки

```typescript
const toolHandler = /* ... */;
const traceLogger = toolHandler.getTraceLogger();

// Получить все события
const allTraces = traceLogger.getTraces();
console.log('All traces:', allTraces);

// Вывести в красивом формате
console.table(allTraces.map(t => ({
  Time: t.timestamp,
  Level: t.level,
  Message: t.message,
  Tool: t.context?.tool_id
})));
```

### Получить события для конкретного инструмента

```typescript
const toolHandler = /* ... */;
const toolId = 'tool-execute-123';

// Получить события для инструмента
const toolTraces = toolHandler.getTraceLogger().getToolTraces(toolId);
console.log(`Tool ${toolId} events:`, toolTraces);

// Получить отчёт
const report = toolHandler.exportToolTraces(toolId);
console.log(report);
```

## Примеры 2: Анализ и отчёты

### Получить ASCII отчёт

```typescript
const toolHandler = /* ... */;

// Отчёт для конкретного инструмента
const toolReport = toolHandler.getTraceReport('tool-id-123');
console.log(toolReport);

// Отчёт для всех инструментов
const allReport = toolHandler.getTraceReport();
console.log(allReport);
```

Пример вывода:

```
════════════════════════════════════════════════════════════════════════════
TRACE DEBUGGER REPORT (Tool: tool-id-123)
════════════════════════════════════════════════════════════════════════════

📊 СТАТИСТИКА
────────────────────────────────────────────────────────────────────────────
Total Events: 45
Trace:  28
Debug:  10
Info:   5
Warn:   2
Error:  0

⏱️  ФАЗЫ
────────────────────────────────────────────────────────────────────────────
APPROVAL_REQUEST      | Count: 1   | Avg: 150ms   | Min: 150ms  | Max: 150ms
TOOL_EXECUTION        | Count: 1   | Avg: 5240ms  | Min: 5240ms | Max: 5240ms
EXECUTE_AND_REPORT    | Count: 1   | Avg: 5120ms  | Min: 5120ms | Max: 5120ms

📈 ВРЕМЕННАЯ ШКАЛА (последние 20 событий)
────────────────────────────────────────────────────────────────────────────
2026-03-05T14:20:10.123Z 🔍 PHASE START: APPROVAL_REQUEST
2026-03-05T14:20:10.234Z 🔍 STEP: APPROVAL_REQUEST -> VALIDATE_EVENT
2026-03-05T14:20:10.245Z 🔍 STEP: APPROVAL_REQUEST -> REQUEST_USER_APPROVAL
2026-03-05T14:20:10.256Z 🔍 USER_APPROVED (120ms)
...
════════════════════════════════════════════════════════════════════════════
```

### Получить детальный JSON отчёт

```typescript
const toolHandler = /* ... */;

// Детальный JSON для инструмента
const detailedJSON = toolHandler.exportDetailedReport('tool-id-123');
const data = JSON.parse(detailedJSON);

console.log('Analysis:', data.analysis);
console.log('Recommendations:', data.recommendations);
console.log('Traces:', data.traces);
```

Структура JSON:

```json
{
  "metadata": {
    "exportedAt": "2026-03-05T14:25:00.000Z",
    "toolId": "tool-id-123",
    "totalEvents": 45
  },
  "analysis": {
    "totalEvents": 45,
    "eventsByLevel": {
      "TRACE": 28,
      "DEBUG": 10,
      "INFO": 5,
      "WARN": 2,
      "ERROR": 0
    },
    "phases": [
      {
        "name": "APPROVAL_REQUEST",
        "count": 1,
        "totalDuration": 150,
        "averageDuration": 150,
        "minDuration": 150,
        "maxDuration": 150
      }
    ],
    "errors": [],
    "timeline": [
      {
        "timestamp": "2026-03-05T14:20:10.123Z",
        "level": "TRACE",
        "message": "[ToolHandler] PHASE START: APPROVAL_REQUEST",
        "duration": null
      }
    ]
  },
  "recommendations": [
    "✅ Выполнение успешно без ошибок и предупреждений."
  ],
  "traces": [/* все события */]
}
```

## Примеры 3: Проверка здоровья инструмента

### Получить статус здоровья

```typescript
const toolHandler = /* ... */;

// Проверить здоровье инструмента
const health = toolHandler.getToolHealthStatus('tool-id-123');

if (health.healthy) {
  console.log('✅ Инструмент здоров!');
} else {
  console.log(`⚠️  Инструмент нездоров! Score: ${health.score}/100`);
  console.log('Issues:', health.issues);
}

// Пример вывода
// ⚠️  Инструмент нездоров! Score: 85/100
// Issues: [ '1 предупреждение', 'Долгое выполнение (15000ms)' ]
```

## Примеры 4: Фильтрация событий

### Получить только ошибки

```typescript
const toolHandler = /* ... */;
const traceDebugger = toolHandler.getTraceDebugger();

// Фильтровать по уровню ERROR
const errors = traceDebugger.filterTraces({
  level: 'ERROR' // или TraceLevel.ERROR
});

errors.forEach(error => {
  console.log(`❌ ${error.timestamp}: ${error.message}`);
  if (error.stack) {
    console.log(error.stack);
  }
});
```

### Получить события для конкретной фазы

```typescript
const toolHandler = /* ... */;
const traceDebugger = toolHandler.getTraceDebugger();

// Фильтровать по фазе
const executionEvents = traceDebugger.filterTraces({
  phase: 'TOOL_EXECUTION'
});

console.log(`Events in TOOL_EXECUTION phase: ${executionEvents.length}`);
executionEvents.forEach(event => {
  console.log(`- ${event.message}`);
});
```

### Получить события по сообщению

```typescript
const toolHandler = /* ... */;
const traceDebugger = toolHandler.getTraceDebugger();

// Фильтровать по regex
const validationEvents = traceDebugger.filterTraces({
  message: /VALIDATION/
});

console.log(`Validation events: ${validationEvents.length}`);
validationEvents.forEach(event => {
  console.log(`- ${event.message}: ${event.context?.reason}`);
});
```

## Примеры 5: Сравнение выполнения инструментов

### Сравнить два инструмента

```typescript
const toolHandler = /* ... */;
const traceDebugger = toolHandler.getTraceDebugger();

const comparison = traceDebugger.compareTools('tool-1', 'tool-2');
console.log(comparison);

// Пример вывода
// СРАВНЕНИЕ ИНСТРУМЕНТОВ
// ────────────────────────────────────────────────────────────────
// Tool 1 (tool-1)
//   Events: 45
//   Duration: 5240ms
//   Errors: 0
// 
// Tool 2 (tool-2)
//   Events: 52
//   Duration: 7120ms
//   Errors: 1
// 
// РАЗНИЦА
//   Events: -7
//   Duration: -1880ms (-35.8%)
//   Errors: -1
```

## Примеры 6: Отладка в VS Code

### Просмотр трассировки в консоли браузера

1. Откройте DevTools (F12)
2. В консоли выполните:

```javascript
// Получить TraceLogger
const traces = window.toolHandler.getTraceLogger().getTraces();

// Вывести в таблицу
console.table(traces.map(t => ({
  Time: t.timestamp.split('T')[1],
  Level: t.level,
  Message: t.message.substring(0, 60),
  Tool: t.context?.tool_id
})));

// Получить отчёт
const report = window.toolHandler.getTraceReport();
console.log(report);
```

### Отличные примеры команд для консоли

```javascript
// Получить все события для инструмента
window.toolHandler.getTraceLogger().getToolTraces('tool-id-123')

// Получить только ошибки
window.toolHandler.getTraceLogger().getTraces().filter(t => t.level === 'ERROR')

// Получить события по сообщению
window.toolHandler.getTraceLogger().getTraces().filter(t => t.message.includes('VALIDATION'))

// Экспортировать JSON
JSON.parse(window.toolHandler.exportDetailedReport('tool-id-123'))

// Проверить здоровье
window.toolHandler.getToolHealthStatus('tool-id-123')

// Скачать отчёт как файл
const report = window.toolHandler.exportAllTraces();
const blob = new Blob([report], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'traces.json';
a.click();
```

## Примеры 7: Обработка ошибок

### Найти и проанализировать ошибки

```typescript
const toolHandler = /* ... */;
const traceDebugger = toolHandler.getTraceDebugger();

// Получить анализ
const analysis = traceDebugger.analyzeTraces();

if (analysis.errors.length > 0) {
  console.log(`Found ${analysis.errors.length} errors:`);
  
  analysis.errors.forEach((error, index) => {
    console.log(`\nError ${index + 1}:`);
    console.log(`  Time: ${error.timestamp}`);
    console.log(`  Message: ${error.message}`);
    console.log(`  Context: ${JSON.stringify(error.context, null, 2)}`);
    if (error.stack) {
      console.log(`  Stack: ${error.stack}`);
    }
  });
} else {
  console.log('✅ No errors found!');
}
```

### Отслеживать ошибки при выполнении

```typescript
const toolHandler = /* ... */;

try {
  await toolHandler.handleToolExecutionSignal(event);
} catch (error) {
  // Получить трассировку ошибки
  const traces = toolHandler.getTraceLogger().getToolTraces(event.tool_id);
  const lastError = traces.reverse().find(t => t.level === 'ERROR');
  
  console.error('Tool execution failed');
  console.error('Last error:', lastError);
  console.error('Full trace:', toolHandler.exportToolTraces(event.tool_id));
}
```

## Примеры 8: Интеграция с мониторингом

### Отправить отчёт на сервер

```typescript
const toolHandler = /* ... */;

async function reportToolExecution(toolId: string) {
  // Получить детальный отчёт
  const report = JSON.parse(toolHandler.exportDetailedReport(toolId));
  
  // Отправить на сервер
  const response = await fetch('/api/tool-execution-trace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      toolId,
      timestamp: new Date().toISOString(),
      analysis: report.analysis,
      recommendations: report.recommendations,
      health: toolHandler.getToolHealthStatus(toolId)
    })
  });
  
  return response.json();
}

// Использование
reportToolExecution('tool-id-123').then(result => {
  console.log('Report sent:', result);
});
```

### Сохранить трассировку локально

```typescript
const toolHandler = /* ... */;

function saveTraceLocally(toolId: string) {
  // Получить отчёт
  const report = toolHandler.exportDetailedReport(toolId);
  
  // Сохранить в localStorage
  localStorage.setItem(`trace_${toolId}`, report);
  
  // Или скачать как файл (браузер)
  if (typeof window !== 'undefined') {
    const blob = new Blob([report], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trace_${toolId}_${new Date().getTime()}.json`;
    link.click();
  }
}
```

## Примеры 9: Отладка конкретных проблем

### Отслеживание параметров

```typescript
const toolHandler = /* ... */;
const traceDebugger = toolHandler.getTraceDebugger();

// Найти события с параметрами
const paramsEvents = traceDebugger.filterTraces({
  message: /PARAMS/
});

paramsEvents.forEach(event => {
  console.log('Event with params:', event);
  console.log('Params:', event.context);
});
```

### Отслеживание валидации

```typescript
const toolHandler = /* ... */;
const traceDebugger = toolHandler.getTraceDebugger();

// Найти события валидации
const validationEvents = traceDebugger.filterTraces({
  message: /VALIDATION/
});

const failedValidations = validationEvents.filter(e => {
  const message = e.message;
  return message.includes('FAILED');
});

if (failedValidations.length > 0) {
  console.log('❌ Failed validations:');
  failedValidations.forEach(event => {
    console.log(`- ${event.message}: ${event.context?.reason}`);
  });
}
```

### Отслеживание таймаутов

```typescript
const toolHandler = /* ... */;
const traceDebugger = toolHandler.getTraceDebugger();

// Найти события таймаутов
const timeoutEvents = traceDebugger.filterTraces({
  message: /TIMEOUT|timeout/i
});

timeoutEvents.forEach(event => {
  console.log('Timeout detected:');
  console.log(`- Tool: ${event.context?.tool_id}`);
  console.log(`- Timeout: ${event.context?.timeout}ms`);
  console.log(`- Elapsed: ${event.context?.elapsedMs}ms`);
});
```

## Примеры 10: Создание кастомных отчётов

### Отчёт по производительности

```typescript
const toolHandler = /* ... */;
const traceDebugger = toolHandler.getTraceDebugger();
const analysis = traceDebugger.analyzeTraces();

console.log('=== PERFORMANCE REPORT ===\n');

console.log('Phase Durations:');
analysis.phases.forEach(phase => {
  console.log(`${phase.name}:`);
  console.log(`  - Count: ${phase.count}`);
  console.log(`  - Average: ${phase.averageDuration.toFixed(2)}ms`);
  console.log(`  - Min/Max: ${phase.minDuration}/${phase.maxDuration}ms`);
});

console.log('\nTotal Events:', analysis.totalEvents);
console.log('Errors:', analysis.errors.length);
console.log('Warnings:', analysis.eventsByLevel.WARN);
```

### Отчёт по временной шкале

```typescript
const toolHandler = /* ... */;
const traceDebugger = toolHandler.getTraceDebugger();
const timeline = traceDebugger.getEventTimeline('tool-id-123');

console.log('=== TIMELINE ===\n');

let lastTime = new Date(timeline[0].timestamp).getTime();

timeline.forEach((entry, index) => {
  const currentTime = new Date(entry.timestamp).getTime();
  const deltaMs = currentTime - lastTime;
  
  console.log(`[${(index + 1).toString().padStart(3)}] +${deltaMs}ms ${entry.level.padEnd(5)} ${entry.message}`);
  
  lastTime = currentTime;
});
```

## Рекомендации

1. **Для отладки**: Используйте `console.log` с выводом трассировки в реальном времени
2. **Для мониторинга**: Сохраняйте JSON отчёты и отправляйте на сервер
3. **Для анализа**: Используйте `TraceDebugger` для получения статистики
4. **Для продакшена**: Отключайте консоль логирование и используйте умеренный буфер (`maxTraces`)

## Полезные ссылки

- [`TraceLogger`](src/tools/TraceLogger.ts) - Основной класс логирования
- [`TraceDebugger`](src/tools/TraceDebugger.ts) - Утилита для анализа
- [`ToolHandler`](src/tools/ToolHandler.ts) - Интеграция в основной обработчик
- [`TRACE_LOGGER_GUIDE.md`](doc/TRACE_LOGGER_GUIDE.md) - Полное руководство
