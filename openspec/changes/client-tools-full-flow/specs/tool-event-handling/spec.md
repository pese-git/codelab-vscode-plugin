# Спецификация: Tool Event Handling

## Описание

Обработка трех новых SSE событий от backend в StreamingClient:
- `tool.approval_request` - запрос на одобрение выполнения tool
- `tool.execution_signal` - сигнал для выполнения tool на клиенте
- `tool.result_ack` - подтверждение получения результата

## Обновления StreamEventSchema

### Текущее состояние
В `src/api/schemas.ts` StreamEventSchema определен с типами в enum `type`:
```
'message_received', 'message_created', 'agent_started', 
'agent_status_changed', 'agent_response', 'agent_completed',
'orchestration_started', 'orchestration_plan_created', 
'orchestration_completed', 'heartbeat', 'direct_agent_call',
'task_started', 'task_progress', 'task_completed', 'error'
```

### Требуемые изменения
Добавить три новых типа в enum:
- `'tool.approval_request'`
- `'tool.execution_signal'`
- `'tool.result_ack'`

## Новые Zod schemas

### ToolApprovalRequestSchema
```
Поля:
- type: 'tool.approval_request' (literal)
- tool_id: string (uuid)
- tool_name: string (read_file | write_file | execute_command | list_directory)
- tool_description?: string (опциональное описание)
- args: Record<string, unknown> (аргументы tool)
- risk_level: enum (low | medium | high | critical)
- estimated_duration_ms?: number (примерное время выполнения)
- timestamp: string (ISO 8601)
- session_id?: string (опциональный session id)

Унаследует от:
- Все поля StreamEvent (agent_id, content, metadata, payload, session_id)
```

### ToolExecutionSignalSchema
```
Поля:
- type: 'tool.execution_signal' (literal)
- tool_id: string (uuid)
- tool_type: string (read_file | write_file | execute_command | list_directory)
- args: Record<string, unknown> (аргументы)
- execution_context?: {
    user_approved: boolean
    approval_time?: string (ISO 8601)
  }
- timestamp: string (ISO 8601)
- session_id?: string

Унаследует от:
- Все поля StreamEvent
```

### ToolResultAckSchema
```
Поля:
- type: 'tool.result_ack' (literal)
- tool_id: string (uuid)
- receipt_status: enum (received | processed | rejected)
- message?: string (опциональное сообщение)
- timestamp: string (ISO 8601)
- session_id?: string

Унаследует от:
- Все поля StreamEvent
```

## Интеграция в StreamingClient

### Регистрация обработчиков

В `src/api/streaming.ts`:

1. **Constructor**
   - Добавить инициализацию ToolHandler (инъекция через параметр)
   - Инициализировать event listeners для tool типов

2. **setupEventListeners()**
   - Добавить обработчики для трех новых типов событий:
     ```typescript
     this.on('tool.approval_request', 
       (event: ToolApprovalRequest) => 
         this.toolHandler.handleToolApprovalRequest(event))
     
     this.on('tool.execution_signal', 
       (event: ToolExecutionSignal) => 
         this.toolHandler.handleToolExecutionSignal(event))
     
     this.on('tool.result_ack', 
       (event: ToolResultAck) => 
         this.toolHandler.handleToolResultAck(event))
     ```

3. **processStreamEvent()**
   - Добавить парсинг и валидацию tool событий
   - Логирование tool событий (для debug)
   - Обработка ошибок при парсинге

### Обработка ошибок парсинга

При ошибке парсинга tool события:
1. Залогировать ошибку с событием
2. Отправить error событие в UI (опциональное сообщение об ошибке)
3. Не прерывать обработку других событий
4. Отправить NACK на backend если нужно

## Типы данных (src/tools/types.ts)

```typescript
export interface ToolApprovalRequest extends StreamEvent {
  type: 'tool.approval_request'
  tool_id: string
  tool_name: ToolName
  tool_description?: string
  args: Record<string, unknown>
  risk_level: RiskLevel
  estimated_duration_ms?: number
}

export interface ToolExecutionSignal extends StreamEvent {
  type: 'tool.execution_signal'
  tool_id: string
  tool_type: ToolType
  args: Record<string, unknown>
  execution_context?: {
    user_approved: boolean
    approval_time?: string
  }
}

export interface ToolResultAck extends StreamEvent {
  type: 'tool.result_ack'
  tool_id: string
  receipt_status: 'received' | 'processed' | 'rejected'
  message?: string
}

export type ToolEvent = 
  | ToolApprovalRequest 
  | ToolExecutionSignal 
  | ToolResultAck

export type ToolName = 
  | 'read_file' 
  | 'write_file' 
  | 'execute_command' 
  | 'list_directory'

export type ToolType = ToolName

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
```

## Валидация событий

### ToolApprovalRequest валидация
- tool_id должен быть валидный UUID
- tool_name должен быть из enum разрешенных tools
- args должен быть object (Record)
- risk_level должен быть валидный enum
- estimated_duration_ms должен быть positive number если предоставлен

### ToolExecutionSignal валидация
- tool_id должен быть валидный UUID
- tool_type должен быть из enum разрешенных tools
- args должен быть object (Record)
- execution_context если предоставлен должен быть object с boolean user_approved

### ToolResultAck валидация
- tool_id должен быть валидный UUID
- receipt_status должен быть валидный enum
- message должен быть string если предоставлен

## Логирование

При обработке tool событий логировать:

**Info уровень:**
- Получение ToolApprovalRequest (tool_id, tool_name, risk_level)
- Получение ToolExecutionSignal (tool_id, tool_type)
- Получение ToolResultAck (tool_id, receipt_status)

**Debug уровень:**
- Полные детали события (args, execution_context)
- Время обработки события
- Статус валидации

**Error уровень:**
- Ошибки парсинга
- Ошибки валидации
- Необработанные исключения

## Тестирование (src/api/__tests__/streaming.test.ts)

### Unit тесты
1. **Parse ToolApprovalRequest**
   - Valid event с минимальными полями
   - Valid event со всеми полями
   - Invalid event (missing required fields)
   - Invalid event (wrong types)
   - Invalid risk_level enum

2. **Parse ToolExecutionSignal**
   - Valid event
   - Valid event с execution_context
   - Invalid event (missing tool_type)
   - Invalid tool_type enum

3. **Parse ToolResultAck**
   - Valid event
   - Invalid receipt_status enum

4. **Event Routing**
   - ToolApprovalRequest роутируется в toolHandler.handleToolApprovalRequest
   - ToolExecutionSignal роутируется в toolHandler.handleToolExecutionSignal
   - ToolResultAck роутируется в toolHandler.handleToolResultAck

5. **Error Handling**
   - Ошибка парсинга не прерывает обработку других событий
   - Ошибка в обработчике логируется и не прерывает поток

## Acceptance Criteria

- [x] StreamEventSchema обновлен с тремя новыми типами
- [ ] Три новых Zod schemas созданы и экспортированы
- [ ] StreamingClient регистрирует обработчики для tool событий
- [ ] Валидация для каждого типа события работает корректно
- [ ] Логирование на всех уровнях (info, debug, error)
- [ ] Unit тесты покрывают все сценарии (100% coverage)
- [ ] Type safety: TypeScript не допускает неправильные типы
- [ ] Documentation для новых типов в JSDoc comments
