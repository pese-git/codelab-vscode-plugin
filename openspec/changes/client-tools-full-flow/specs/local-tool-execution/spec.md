# Спецификация: Local Tool Execution

## Описание

Локальное выполнение инструментов на VS Code plugin клиенте. ToolHandler - главный оркестратор, который координирует выполнение всех типов tools используя специализированные executors.

## ToolHandler класс (src/tools/handler.ts)

### Constructor

```typescript
constructor(
  private api: CodeLabAPI,
  private dialogProvider: IApprovalDialogProvider,
  private logger: Logger,
  config?: ToolHandlerConfig
)
```

Параметры:
- `api`: CodeLabAPI инстанс для отправки результатов
- `dialogProvider`: поставщик approval dialog
- `logger`: logger для отладки и аудита
- `config`: опциональная конфигурация (timeout defaults, concurrency limits)

### Инициализация

При создании ToolHandler:
1. Инициализировать FileSystemExecutor
2. Инициализировать CommandExecutor
3. Инициализировать PathValidator
4. Создать пустую Map для pending approvals
5. Создать пустую Map для active executions
6. Создать пустой array для execution history
7. Установить initial concurrent count = 0

### Основные методы

#### handleToolApprovalRequest(event: ToolApprovalRequest)

Обработка запроса на одобрение:

1. **Валидация события**
   - Проверить что tool_id уникален (нет дубликатов)
   - Проверить что tool_name валиден

2. **Логирование**
   - Info: "Tool approval request received: {tool_id}, {tool_name}, risk_level={risk_level}"

3. **Запрос одобрения пользователя**
   - Вызвать `requestUserApproval(event)`
   - Получить Promise<boolean>

4. **Отправка результата**
   - Если одобрено: `api.approveToolExecution(tool_id)`
   - Если отклонено: `api.rejectToolExecution(tool_id, 'User declined')`

5. **Обработка ошибок**
   - Если ошибка при отправке: залогировать и повторить (max 3 times)
   - Если timeout при ожидании одобрения: отклонить автоматически

#### handleToolExecutionSignal(event: ToolExecutionSignal)

Обработка сигнала выполнения:

1. **Проверка preconditions**
   - Проверить что tool_id существует в pending approvals или user_approved в execution_context
   - Проверить что concurrent count < 3 (иначе queue)

2. **Логирование**
   - Info: "Tool execution signal received: {tool_id}, {tool_type}"

3. **Выполнение**
   - Вызвать `executeAndReport(event)`
   - Получить Promise<ToolExecutionResult>

4. **Отправка результата**
   - `api.sendToolResult(tool_id, result)`

5. **Cleanup**
   - Удалить из pending approvals (если было)
   - Удалить из active executions
   - Декремент concurrent count

#### handleToolResultAck(event: ToolResultAck)

Обработка подтверждения получения результата:

1. **Логирование**
   - Info: "Tool result ack received: {tool_id}, {receipt_status}"

2. **Обновление state**
   - Удалить из active executions если был там
   - Обновить execution history

3. **Обработка ошибок**
   - Если receipt_status = 'rejected': залогировать error message от backend

#### requestUserApproval(event: ToolApprovalRequest, timeout: number = 300000)

Приватный метод для запроса одобрения:

1. **Создать Promise с resolver**
   ```typescript
   new Promise((resolve, reject) => {
     this.toolApprovalMap.set(event.tool_id, {
       request: event,
       timeout: setTimeout(() => {
         this.toolApprovalMap.delete(event.tool_id)
         resolve(false)
       }, timeout),
       resolver: resolve
     })
   })
   ```

2. **Показать диалог**
   - `dialogProvider.showApprovalDialog(event)`
   - Получить Promise<boolean> от пользователя

3. **Обработать результат**
   - Очистить timeout
   - Удалить из map
   - Return результат пользователя

#### executeAndReport(event: ToolExecutionSignal)

Приватный метод для выполнения tool и отправки результата:

1. **Инкремент concurrent count**
   - `this.concurrentCount++`
   - Если превышен лимит (3): queue и wait

2. **Валидация tool_type**
   - Проверить что tool_type в enum разрешенных tools

3. **Выполнение в зависимости от типа**
   - `read_file` → `fileSystemExecutor.executeReadFile(args)`
   - `write_file` → `fileSystemExecutor.executeWriteFile(args)`
   - `list_directory` → `fileSystemExecutor.executeListDirectory(args)`
   - `execute_command` → `commandExecutor.executeCommand(args)`

4. **Обработка результата**
   - Логировать результат (успех или ошибка)
   - Создать ToolExecutionResult object
   - Return result

5. **Обработка ошибок**
   - Catch все ошибки
   - Логировать error с деталями
   - Создать error result с error message

6. **Декремент concurrent count**
   - `this.concurrentCount--`
   - Обработать queued executions если есть

### ToolHandlerConfig

```typescript
interface ToolHandlerConfig {
  commandTimeoutMs?: number  // default 300000 (5 min)
  fileSize MaxBytes?: number  // default 100 * 1024 * 1024 (100MB)
  concurrencyLimit?: number   // default 3
  approvalTimeoutMs?: number  // default 300000 (5 min)
  enableCaching?: boolean     // default true
  cacheTtlMs?: number         // default 300000 (5 min)
}
```

## ToolExecutionResult тип

```typescript
interface ToolExecutionResult {
  tool_id: string
  tool_type: ToolType
  status: 'success' | 'error' | 'timeout' | 'cancelled'
  output?: unknown
  error?: {
    message: string
    code?: string
    details?: unknown
  }
  duration_ms: number
  timestamp: string
}
```

## Состояние ToolHandler

### Pending Approvals Map

```typescript
type PendingApprovals = Map<string, {
  request: ToolApprovalRequest
  timeout: NodeJS.Timeout
  resolver: (approved: boolean) => void
}>
```

### Active Executions Map

```typescript
type ActiveExecutions = Map<string, {
  signal: ToolExecutionSignal
  process?: ChildProcess
  timeout: NodeJS.Timeout
  startTime: Date
}>
```

### Execution History Array

```typescript
interface ExecutionHistoryEntry {
  tool_id: string
  tool_type: ToolType
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'failed'
  startTime: Date
  endTime?: Date
  duration_ms?: number
  error?: string
  user_approved?: boolean
  risk_level?: RiskLevel
}
```

### Concurrent Execution Counter

```typescript
concurrentCount: number = 0
concurrentQueue: Array<{
  event: ToolExecutionSignal
  resolver: (result: ToolExecutionResult) => void
}> = []
```

## Интеграция с другими компонентами

### FileSystemExecutor

ToolHandler использует FileSystemExecutor для файловых операций:

```typescript
private fileSystemExecutor: FileSystemExecutor

// В executeAndReport()
case 'read_file':
  result = await this.fileSystemExecutor.executeReadFile(event.args)
  break
case 'write_file':
  result = await this.fileSystemExecutor.executeWriteFile(event.args)
  break
case 'list_directory':
  result = await this.fileSystemExecutor.executeListDirectory(event.args)
  break
```

### CommandExecutor

ToolHandler использует CommandExecutor для команд:

```typescript
private commandExecutor: CommandExecutor

// В executeAndReport()
case 'execute_command':
  result = await this.commandExecutor.executeCommand(
    event.args.command,
    event.args.args,
    this.config.commandTimeoutMs
  )
  break
```

### PathValidator

ToolHandler использует PathValidator для валидации путей:

```typescript
private pathValidator: PathValidator

// Внутри executors перед операцией
const validationResult = await this.pathValidator.validatePath(path)
if (!validationResult.valid) {
  throw new PathValidationError(validationResult.error)
}
```

## Обработка ошибок

### Исключения которые ToolHandler может выбросить

1. **ToolTypeError** - неизвестный tool_type
2. **ConcurrencyLimitError** - достигнут лимит одновременных выполнений
3. **ToolApprovalTimeout** - timeout при ожидании одобрения
4. **ExecutionCancelled** - выполнение отменено пользователем

### Обработка в executeAndReport()

Все исключения при выполнении должны:
1. Быть caught в try-catch блоке
2. Логироваться с полными деталями
3. Преобразоваться в ToolExecutionResult с status='error'
4. Отправиться в sendToolResult() даже при ошибке

## Логирование

ToolHandler должен логировать на разных уровнях:

**Info:**
- Tool approval request received
- Tool execution signal received
- Tool execution started/completed/failed
- Tool result ack received

**Debug:**
- Tool args и детали
- Validator результаты
- Executor результаты
- Timing информация

**Error:**
- Ошибки валидации
- Ошибки выполнения
- Ошибки отправки результатов
- Ошибки timeout

## Dispose/Cleanup

```typescript
dispose() {
  // Отменить все pending approvals
  for (const [toolId, approval] of this.toolApprovalMap) {
    clearTimeout(approval.timeout)
    approval.resolver(false)
  }
  this.toolApprovalMap.clear()
  
  // Отменить все active executions
  for (const [toolId, execution] of this.activeExecutions) {
    clearTimeout(execution.timeout)
    if (execution.process) {
      execution.process.kill('SIGTERM')
    }
  }
  this.activeExecutions.clear()
  
  // Очистить queued executions
  this.concurrentQueue = []
}
```

## Тестирование (src/tools/__tests__/handler.test.ts)

### Unit тесты

1. **Initialization**
   - Executors инициализированы
   - Maps пусты
   - Concurrent count = 0

2. **handleToolApprovalRequest**
   - Valid request обрабатывается
   - Dialog показывается
   - Одобрение отправляется на backend
   - Rejection отправляется на backend
   - Timeout при ожидании одобрения автоматически отклоняет

3. **handleToolExecutionSignal**
   - Valid signal обрабатывается
   - Выполнение деллегируется к правильному executor
   - Результат отправляется на backend

4. **Concurrency control**
   - Max 3 concurrent executions enforced
   - Queued executions обрабатываются по очереди
   - Concurrent count правильно управляется

5. **Error handling**
   - Ошибки executor пойманы и залогированы
   - Ошибки не прерывают обработку
   - Error result возвращается пользователю

6. **Dispose**
   - Все timeouts очищены
   - Все processes завершены
   - Maps очищены

## Acceptance Criteria

- [ ] ToolHandler класс реализован с методами handleToolApprovalRequest, handleToolExecutionSignal, handleToolResultAck
- [ ] Pending approvals Map работает с timeouts и resolvers
- [ ] Active executions Map отслеживает текущие executions
- [ ] Concurrency control ограничивает max 3 одновременных выполнений
- [ ] Execution history логирует все операции
- [ ] Все ошибки обработаны и залогированы
- [ ] Dispose очищает ресурсы
- [ ] Unit тесты покрывают все методы (100% coverage)
- [ ] Логирование работает на всех уровнях
- [ ] Integration с API для отправки результатов работает
