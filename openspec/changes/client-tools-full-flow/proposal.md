# Proposal: Полный Flow Выполнения Tool на VS Code Plugin

## Why

Backend на сервере полностью реализован и production-ready (85 unit tests), поддерживает выполнение tools через tool executor:
- `tool.approval_request` - запрос на одобрение выполнения tool
- `tool.execution_signal` - сигнал для выполнения tool на клиенте
- `tool.result_ack` - подтверждение получения результата

**Проблема:** VS Code plugin не имеет ни одного компонента для работы с tools. Это создает критический разрыв между возможностями backend и функциональностью plugin. Агент на сервере готов использовать tools (file operations, command execution), но plugin не может их обрабатывать и выполнять.

## What Changes

Реализация полного tool execution flow на клиенте (VS Code plugin):

1. **Tool Event Handling** - Обработка трех новых SSE событий в StreamingClient
2. **Local Tool Execution** - Локальное выполнение tools (read_file, write_file, execute_command, list_directory)
3. **Tool Approval Flow** - User approval flow перед выполнением tool (особенно для опасных операций)
4. **File System Operations** - Безопасное выполнение file operations с валидацией путей
5. **Command Execution** - Выполнение shell команд с timeout и process management

## Capabilities

### 1. tool-event-handling
Обработка SSE событий от backend:
- Парсинг и валидация tool events
- Маршрутизация событий в ToolHandler
- Типизированные payload для каждого события типа

### 2. local-tool-execution
Локальное выполнение инструментов:
- ToolHandler - оркестратор выполнения
- Поддержка 4 типов tools: read_file, write_file, execute_command, list_directory
- Кэширование результатов
- Обработка ошибок и таймаутов

### 3. tool-approval-flow
User approval workflow:
- ApprovalDialog компонент с risk level индикацией
- Async approval/rejection handling
- Audit logging операций
- Timeout для unanswered requests (5 min)

### 4. file-system-operations
Безопасные файловые операции:
- FileSystemExecutor для read/write/list операций
- PathValidator с workspace boundary protection
- File size limits (100MB max)
- Permission checks через VS Code API

### 5. command-execution
Выполнение shell команд:
- CommandExecutor с process management
- Timeout protection (5 min default)
- Output streaming
- Signal handling (SIGTERM, SIGKILL)
- Concurrent execution limits (3 max)

## Impact

### New Modules
```
src/tools/
├── types.ts                  # Type definitions
├── handler.ts               # ToolHandler (orchestrator)
├── executors/
│   ├── file-system.ts       # FileSystemExecutor
│   └── command.ts           # CommandExecutor
├── validators/
│   └── path.ts              # PathValidator
└── __tests__/
    ├── handler.test.ts
    ├── file-system.test.ts
    └── command.test.ts
```

### Modified Files
- `src/api/schemas.ts` - Новые schemas для tool events
- `src/api/client.ts` - API методы для tool results/approvals
- `src/api/streaming.ts` - Tool event handlers в StreamingClient
- `src/extension.ts` - Инициализация ToolHandler и cleanup

### New UI Components
```
webview/src/components/Tools/
├── ApprovalDialog.tsx       # Tool approval UI
├── ToolProgressBar.tsx      # Progress indicator
└── ToolStatusView.tsx       # Status panel
```

### Testing Strategy
- Unit tests для каждого executor (path validation, execution)
- Integration tests для ToolHandler
- E2E tests для approval flow
- Security tests для path traversal protection

## Security Considerations

1. **Path Traversal Protection** - PathValidator проверяет workspace boundary
2. **Command Whitelist** - Разрешены только безопасные команды (ls, cat, mkdir и т.д.)
3. **File Size Limits** - 100MB max per file operation
4. **Execution Timeouts** - 5 minutes max per command
5. **Concurrent Limits** - Max 3 concurrent executions
6. **User Approval** - Critical operations требуют явного одобрения
7. **Audit Logging** - Все операции логируются для безопасности

## Acceptance Criteria

- [ ] Все SSE tool events корректно обрабатываются
- [ ] Tool execution flow работает end-to-end
- [ ] User approval dialog работает и интегрирован
- [ ] Все операции защищены от path traversal
- [ ] Command execution имеет timeout protection
- [ ] Unit test coverage ≥ 85%
- [ ] Integration tests проходят успешно
- [ ] Security audit завершен
