# Tasks: Детальный План Реализации

## Фаза 1: Типы и Схемы (Priority: Critical)

Эта фаза создает foundation для всех остальных компонентов.

### Task 1.1: Обновить StreamEventSchema в schemas.ts
- **Location**: `src/api/schemas.ts:92`
- **Description**: Добавить три новых типа событий в StreamEventSchema enum
  - `'tool.approval_request'`
  - `'tool.execution_signal'`
  - `'tool.result_ack'`
- **Changes**:
  - Обновить enum `type` в StreamEventSchema
  - Обновить enum `event_type` в StreamEventSchema
- **Dependencies**: None
- **Estimated Size**: Small (10 lines)
- **Acceptance Criteria**:
  - [ ] Three new event types added to enum
  - [ ] Validation works for new types
  - [ ] Backward compatible with existing events

### Task 1.2: Создать Zod schemas для tool events
- **Location**: `src/api/schemas.ts` (добавить в конец файла)
- **Description**: Создать три новых Zod schemas
  - `ToolApprovalRequestSchema`
  - `ToolExecutionSignalSchema`
  - `ToolResultAckSchema`
- **Changes**:
  - Определить ToolApprovalRequestSchema с полями: tool_id, tool_name, args, risk_level, estimated_duration_ms
  - Определить ToolExecutionSignalSchema с полями: tool_id, tool_type, args, execution_context
  - Определить ToolResultAckSchema с полями: tool_id, receipt_status, message
  - Экспортировать TypeScript типы для каждого schema
- **Dependencies**: Task 1.1
- **Estimated Size**: Medium (50 lines)
- **Acceptance Criteria**:
  - [ ] All three schemas defined and exported
  - [ ] Type inference works correctly
  - [ ] Validation catches missing required fields
  - [ ] Validation passes for valid data

### Task 1.3: Создать src/tools/types.ts
- **Location**: `src/tools/types.ts` (новый файл)
- **Description**: Создать type definitions для всех tool компонентов
- **Changes**:
  - Определить ToolType = 'read_file' | 'write_file' | 'execute_command' | 'list_directory'
  - Определить RiskLevel = 'low' | 'medium' | 'high' | 'critical'
  - Определить ToolEvent = ToolApprovalRequest | ToolExecutionSignal | ToolResultAck
  - Определить ToolExecutionResult с status, output, error, duration_ms
  - Определить ExecutionContext для tool выполнения
  - Определить все error types (ToolTypeError, ConcurrencyLimitError и т.д.)
- **Dependencies**: Task 1.2
- **Estimated Size**: Medium (150 lines)
- **Acceptance Criteria**:
  - [ ] All types defined and exported
  - [ ] Types align with schemas
  - [ ] Discriminated unions work correctly
  - [ ] Error types properly typed

---

## Фаза 2: Tool Execution Infrastructure (Priority: Critical)

### Task 2.1: Создать PathValidator класс
- **Location**: `src/tools/validators/path.ts` (новый файл)
- **Description**: Реализовать PathValidator для безопасной валидации путей
- **Changes**:
  - Реализовать validatePath() с полной валидацией
  - Реализовать validateWorkspaceBoundary() проверку
  - Реализовать resolvePath() с symlink разрешением
  - Реализовать checkFileSize() проверку (max 100MB)
  - Реализовать normalizePath() приватный метод
  - Реализовать isPathBlocked() приватный метод
  - Добавить PathValidationError класс
  - Логирование на debug и error уровнях
- **Dependencies**: Task 1.3
- **Estimated Size**: Large (400 lines)
- **Acceptance Criteria**:
  - [ ] All methods implemented
  - [ ] Path traversal protection works
  - [ ] Workspace boundary checks work
  - [ ] Symlink resolution with boundary check works
  - [ ] File size checks (100MB) enforced
  - [ ] Error handling for all scenarios
  - [ ] Unit tests pass (≥95% coverage)

### Task 2.2: Создать FileSystemExecutor класс
- **Location**: `src/tools/executors/file-system.ts` (новый файл)
- **Description**: Реализовать FileSystemExecutor для файловых операций
- **Changes**:
  - Реализовать executeReadFile() метод
  - Реализовать executeWriteFile() метод
  - Реализовать executeListDirectory() метод
  - Работа с VS Code API (workspace.fs)
  - Поддержка различных кодировок (utf-8, utf-16)
  - Обработка ошибок (FileNotFoundError, PermissionDeniedError и т.д.)
  - Логирование операций
  - Кэширование результатов read (опциональное, TTL 5 min)
- **Dependencies**: Task 2.1
- **Estimated Size**: Large (500 lines)
- **Acceptance Criteria**:
  - [ ] All three methods implemented
  - [ ] Read operations work (various encodings)
  - [ ] Write operations work (create/overwrite)
  - [ ] Directory listing works (recursive with pattern)
  - [ ] File size limits enforced
  - [ ] All errors handled properly
  - [ ] Caching works (if enabled)
  - [ ] Unit tests pass (≥95% coverage)

### Task 2.3: Создать CommandExecutor класс
- **Location**: `src/tools/executors/command.ts` (новый файл)
- **Description**: Реализовать CommandExecutor для выполнения команд
- **Changes**:
  - Реализовать executeCommand() метод
  - Реализовать validateCommand() с whitelist проверкой
  - Process spawning и management
  - Timeout handling (SIGTERM + SIGKILL)
  - Output accumulation (max 10MB)
  - Signal handling
  - Concurrent execution limits (max 3)
  - Обработка ошибок (CommandNotFound, Timeout и т.д.)
  - Логирование операций
- **Dependencies**: Task 1.3
- **Estimated Size**: Large (550 lines)
- **Acceptance Criteria**:
  - [ ] executeCommand() works
  - [ ] Command whitelist validated
  - [ ] Timeout protection (SIGTERM + SIGKILL)
  - [ ] Output collected (10MB limit)
  - [ ] Concurrency limit (max 3) enforced
  - [ ] All errors handled properly
  - [ ] Unit tests pass (≥95% coverage)

### Task 2.4: Создать ToolHandler класс
- **Location**: `src/tools/handler.ts` (новый файл)
- **Description**: Реализовать главный оркестратор для tool выполнения
- **Changes**:
  - Конструктор с инъекцией FileSystemExecutor, CommandExecutor, PathValidator
  - Реализовать handleToolApprovalRequest() метод
  - Реализовать handleToolExecutionSignal() метод
  - Реализовать handleToolResultAck() метод
  - Приватный метод requestUserApproval() с timeouts
  - Приватный метод executeAndReport() для выполнения
  - Управление state: pendingApprovals, activeExecutions, executionHistory
  - Обработка concurrency limits
  - Логирование и аудит
  - Dispose методи cleanup
- **Dependencies**: Task 2.1, Task 2.2, Task 2.3
- **Estimated Size**: Large (600 lines)
- **Acceptance Criteria**:
  - [ ] All methods implemented
  - [ ] Approval flow works end-to-end
  - [ ] Execution signal handling works
  - [ ] Result ack handling works
  - [ ] Concurrency control works
  - [ ] State management correct
  - [ ] All errors handled properly
  - [ ] Audit logging works
  - [ ] Unit tests pass (≥95% coverage)

---

## Фаза 3: API Integration (Priority: High)

### Task 3.1: Добавить методы в CodeLabAPI
- **Location**: `src/api/client.ts`
- **Description**: Добавить три новых метода для tool API
- **Changes**:
  - Добавить approveToolExecution(toolId, metadata?) метод
  - Добавить rejectToolExecution(toolId, reason) метод
  - Добавить sendToolResult(toolId, result) метод
  - Каждый метод делает POST запрос на backend
  - Обработка ошибок (HTTP errors, auth errors)
  - Логирование запросов
- **Dependencies**: Task 1.3
- **Estimated Size**: Small (80 lines)
- **Acceptance Criteria**:
  - [ ] All three methods added
  - [ ] Methods call correct endpoints
  - [ ] Error handling works
  - [ ] Headers properly set (auth, content-type)

### Task 3.2: Интегрировать ToolHandler в StreamingClient
- **Location**: `src/api/streaming.ts`
- **Description**: Регистрировать tool event handlers в StreamingClient
- **Changes**:
  - Добавить инъекцию ToolHandler в конструктор
  - Регистрировать обработчики для трех событий:
    - 'tool.approval_request'
    - 'tool.execution_signal'
    - 'tool.result_ack'
  - Парсинг и валидация tool событий
  - Маршрутизация в ToolHandler
  - Обработка ошибок парсинга
  - Логирование
- **Dependencies**: Task 2.4, Task 3.1
- **Estimated Size**: Medium (150 lines)
- **Acceptance Criteria**:
  - [ ] Tool events parsed correctly
  - [ ] Events routed to ToolHandler
  - [ ] Error handling for invalid events
  - [ ] Logging works

### Task 3.3: Инициализация в extension.ts
- **Location**: `src/extension.ts`
- **Description**: Инициализировать ToolHandler и подключить к extension
- **Changes**:
  - Создать инстанс ToolHandler в activate()
  - Подключить к StreamingClient
  - Регистрировать в context.subscriptions для cleanup
  - Реализовать deactivate() очистку (kill процессы, cancel timeouts)
  - Логирование initialization
- **Dependencies**: Task 2.4, Task 3.2
- **Estimated Size**: Small (50 lines)
- **Acceptance Criteria**:
  - [ ] ToolHandler initialized correctly
  - [ ] Connected to StreamingClient
  - [ ] Cleanup on deactivate works
  - [ ] No resource leaks

---

## Фаза 4: UI Components (Priority: High)

### Task 4.1: Создать ToolApprovalBlock компонент
- **Location**: `webview/src/components/Tools/ToolApprovalBlock.tsx` (новый файл)
- **Description**: Реализовать React компонент для встроенного одобрения tool (inline блок над полем ввода, как в RooCode)
- **Changes**:
  - Определить ToolApprovalBlockProps интерфейс
  - Реализовать встроенный блок (не modal) с компактным дизайном
  - Tool информация (name, description, risk level)
  - Risk level badge с цветами (low=зеленый, medium=оранжевый, high=красный, critical=черный)
  - Arguments display (JSON, truncated с опцией expand)
  - Action buttons: Approve, Reject на одной строке
  - Close button (X) = reject
  - Loading state с spinner
  - Countdown timer при timeout (показывать в последние 30 сек)
  - Auto-removal из UI после approve/reject
  - Smooth scroll в view при появлении
  - Локализация поддержка
- **Dependencies**: Task 1.3
- **Estimated Size**: Medium (250 lines)
- **Acceptance Criteria**:
  - [ ] Component renders as inline block (not modal)
  - [ ] Integrates with MessageList correctly
  - [ ] Risk level badge shows correct colors
  - [ ] Buttons functional (approve/reject)
  - [ ] Close button works (rejects)
  - [ ] Loading state works (spinner, disabled buttons)
  - [ ] Countdown timer displays in last 30s
  - [ ] Auto-removes after action
  - [ ] Smooth scroll to view on appearance
  - [ ] Localization keys used

### Task 4.2: Создать CSS модуль для ToolApprovalBlock
- **Location**: `webview/src/components/Tools/ToolApprovalBlock.module.css` (новый файл)
- **Description**: Стилизация ToolApprovalBlock компонента (встроенный блок)
- **Changes**:
  - Встроенный блок стили (background, border, padding, margin)
  - Header стили (icon, title, close button)
  - Tool информация стили (font, color, spacing)
  - Risk badge стили (для каждого level с уникальными цветами)
  - Arguments display стили (monospace font, overflow handling)
  - Action buttons стили (flex, sizes, hover states)
  - Loading spinner animation (smooth rotation)
  - Countdown timer стили
  - Responsive design для различных экранов
- **Dependencies**: Task 4.1
- **Estimated Size**: Small (180 lines)
- **Acceptance Criteria**:
  - [ ] Styles applied correctly
  - [ ] Colors match risk levels exactly
  - [ ] Buttons sized appropriately
  - [ ] Spinner animation smooth
  - [ ] Responsive on mobile (buttons stack if needed)
  - [ ] Hover states working
  - [ ] Close button positioned correctly

### Task 4.3: Создать ToolProgressBar компонент
- **Location**: `webview/src/components/Tools/ToolProgressBar.tsx` (новый файл)
- **Description**: Реализовать прогресс-бар для выполняющихся tool операций
- **Changes**:
  - Progress bar компонент
  - Отображение текущего инструмента
  - Процент выполнения
  - ETA (если доступно)
  - Cancel button
  - Localization support
- **Dependencies**: Task 1.3
- **Estimated Size**: Small (150 lines)
- **Acceptance Criteria**:
  - [ ] Component renders
  - [ ] Progress updates
  - [ ] Cancel button works
  - [ ] ETA displays

### Task 4.4: Создать ToolStatusView компонент
- **Location**: `webview/src/components/Tools/ToolStatusView.tsx` (новый файл)
- **Description**: Реализовать статус-панель для истории tool операций
- **Changes**:
  - Status panel компонент
  - Список последних операций
  - Статус (success/error/timeout)
  - Duration информация
  - Error messages display
  - Clear history button
  - Localization support
- **Dependencies**: Task 1.3
- **Estimated Size**: Small (200 lines)
- **Acceptance Criteria**:
  - [ ] Component renders
  - [ ] Operations list displays
  - [ ] Status colors correct
  - [ ] Error messages shown
  - [ ] Clear history works

### Task 4.5: Добавить i18n сообщения
- **Location**: `src/i18n/messages.ts` и `webview/src/i18n/` (updates)
- **Description**: Добавить локализованные сообщения для tool компонентов
- **Changes**:
  - Сообщения для ApprovalDialog
  - Сообщения для ToolProgressBar
  - Сообщения для ToolStatusView
  - Сообщения для ошибок
  - Поддержка русского и английского языков
- **Dependencies**: Task 4.1, Task 4.3, Task 4.4
- **Estimated Size**: Small (150 lines)
- **Acceptance Criteria**:
  - [ ] All UI messages translated
  - [ ] i18n keys used consistently
  - [ ] Russian and English supported

---

## Фаза 5: Testing & Documentation (Priority: High)

### Task 5.1: Юнит тесты для PathValidator
- **Location**: `src/tools/validators/__tests__/path.test.ts` (новый файл)
- **Description**: Comprehensive тесты для PathValidator класса
- **Changes**:
  - Тесты для validatePath()
  - Тесты для validateWorkspaceBoundary()
  - Тесты для resolvePath()
  - Тесты для checkFileSize()
  - Security тесты (path traversal, symlinks и т.д.)
  - Target coverage: ≥95%
- **Dependencies**: Task 2.1
- **Estimated Size**: Medium (400 lines)
- **Acceptance Criteria**:
  - [ ] All methods tested
  - [ ] Path traversal tests pass
  - [ ] Workspace boundary tests pass
  - [ ] Coverage ≥95%

### Task 5.2: Юнит тесты для FileSystemExecutor
- **Location**: `src/tools/__tests__/file-system.test.ts` (новый файл)
- **Description**: Comprehensive тесты для FileSystemExecutor класса
- **Changes**:
  - Тесты для executeReadFile()
  - Тесты для executeWriteFile()
  - Тесты для executeListDirectory()
  - Тесты для error handling
  - Target coverage: ≥95%
- **Dependencies**: Task 2.2
- **Estimated Size**: Medium (400 lines)
- **Acceptance Criteria**:
  - [ ] All methods tested
  - [ ] Error handling tested
  - [ ] Coverage ≥95%

### Task 5.3: Юнит тесты для CommandExecutor
- **Location**: `src/tools/__tests__/command.test.ts` (новый файл)
- **Description**: Comprehensive тесты для CommandExecutor класса
- **Changes**:
  - Тесты для executeCommand()
  - Тесты для validateCommand()
  - Тесты для timeout handling
  - Тесты для concurrency control
  - Target coverage: ≥95%
- **Dependencies**: Task 2.3
- **Estimated Size**: Medium (450 lines)
- **Acceptance Criteria**:
  - [ ] All methods tested
  - [ ] Timeout tests pass
  - [ ] Concurrency tests pass
  - [ ] Coverage ≥95%

### Task 5.4: Юнит тесты для ToolHandler
- **Location**: `src/tools/__tests__/handler.test.ts` (новый файл)
- **Description**: Comprehensive тесты для ToolHandler класса
- **Changes**:
  - Тесты для handleToolApprovalRequest()
  - Тесты для handleToolExecutionSignal()
  - Тесты для handleToolResultAck()
  - Тесты для state management
  - Target coverage: ≥95%
- **Dependencies**: Task 2.4
- **Estimated Size**: Large (500 lines)
- **Acceptance Criteria**:
  - [ ] All methods tested
  - [ ] State management tested
  - [ ] Error handling tested
  - [ ] Coverage ≥95%

### Task 5.5: Integration тесты для tool flow
- **Location**: `src/tools/__tests__/approval-flow.test.ts` (новый файл)
- **Description**: End-to-end integration тесты для tool approval flow
- **Changes**:
  - Full approval request → approval → execution → result flow
  - Rejection flow
  - Timeout flow
  - Error scenarios
  - Target coverage: ≥85%
- **Dependencies**: Task 2.4, Task 3.1, Task 3.2
- **Estimated Size**: Medium (300 lines)
- **Acceptance Criteria**:
  - [ ] Approval flow tested
  - [ ] Rejection flow tested
  - [ ] Timeout flow tested
  - [ ] Error scenarios tested

### Task 5.6: React компонент тесты
- **Location**: `webview/src/components/Tools/__tests__/ApprovalDialog.test.tsx` (новый файл)
- **Description**: Тесты для React компонентов
- **Changes**:
  - Тесты для ApprovalDialog rendering
  - Тесты для user interactions
  - Тесты для risk level indicator
  - Target coverage: ≥85%
- **Dependencies**: Task 4.1
- **Estimated Size**: Small (250 lines)
- **Acceptance Criteria**:
  - [ ] Component renders correctly
  - [ ] User interactions work
  - [ ] Risk level indicator correct
  - [ ] Coverage ≥85%

### Task 5.7: Documentation обновить
- **Location**: `doc/` directory
- **Description**: Обновить документацию для tool features
- **Changes**:
  - Добавить tool execution documentation
  - Добавить API documentation
  - Добавить error handling guide
  - Добавить examples использования
- **Dependencies**: All previous tasks
- **Estimated Size**: Medium (300 lines)
- **Acceptance Criteria**:
  - [ ] All features documented
  - [ ] Examples provided
  - [ ] API documented
  - [ ] Error handling documented

---

## Фаза 6: Security & Performance (Priority: Medium)

### Task 6.1: Security audit для tool компонентов
- **Location**: N/A (review tasks)
- **Description**: Провести security audit implementation
- **Changes**:
  - Code review для path validation
  - Code review для command execution
  - Code review для file operations
  - Проверка на CVEs
  - Penetration testing для path traversal
- **Dependencies**: All implementation tasks
- **Estimated Size**: N/A (review only)
- **Acceptance Criteria**:
  - [ ] No path traversal vulnerabilities
  - [ ] No command injection vulnerabilities
  - [ ] No file access vulnerabilities
  - [ ] Security audit passed

### Task 6.2: Performance optimization
- **Location**: `src/tools/` (optimization)
- **Description**: Оптимизировать performance tool execution
- **Changes**:
  - Оптимизировать path validation (caching)
  - Оптимизировать file operations (streaming для больших файлов)
  - Оптимизировать process management
  - Профилирование memory usage
- **Dependencies**: All implementation tasks
- **Estimated Size**: Medium (200 lines)
- **Acceptance Criteria**:
  - [ ] File operations optimized
  - [ ] Memory usage acceptable
  - [ ] Path validation cached
  - [ ] No performance regressions

---

## Фаза 7: Integration & Finalization (Priority: Medium)

### Task 7.1: Интеграция в ChatViewProvider
- **Location**: `src/ui/ChatViewProvider.ts`
- **Description**: Интегрировать tool UI компоненты в chat view
- **Changes**:
  - Добавить ApprovalDialog в webview
  - Добавить ToolProgressBar в webview
  - Добавить ToolStatusView в webview
  - Message passing между extension и webview
- **Dependencies**: Task 4.1, Task 4.3, Task 4.4
- **Estimated Size**: Small (150 lines)
- **Acceptance Criteria**:
  - [ ] Components integrated
  - [ ] Message passing works
  - [ ] UI updates correctly

### Task 7.2: Проверка совместимости
- **Location**: N/A (testing)
- **Description**: Проверить совместимость со всеми компонентами
- **Changes**:
  - Проверить что не сломалась существующая функциональность
  - Проверить что все existing tests проходят
  - Проверить что нет регрессий
- **Dependencies**: All tasks
- **Estimated Size**: N/A (testing only)
- **Acceptance Criteria**:
  - [ ] All existing tests pass
  - [ ] No regressions
  - [ ] New tests pass

### Task 7.3: Финальная документация & README
- **Location**: `README.md` и `doc/`
- **Description**: Обновить documentation и README
- **Changes**:
  - Обновить README с tool features описанием
  - Добавить examples в документацию
  - Обновить API documentation
  - Добавить troubleshooting guide
- **Dependencies**: All previous tasks
- **Estimated Size**: Small (200 lines)
- **Acceptance Criteria**:
  - [ ] README updated
  - [ ] Examples provided
  - [ ] Troubleshooting guide included

---

## Priority & Dependencies Summary

### Critical Path (должны быть сделаны в первую очередь):
1. Task 1.1 → 1.2 → 1.3 (Types & Schemas)
2. Task 2.1 (PathValidator)
3. Task 2.2 (FileSystemExecutor)
4. Task 2.3 (CommandExecutor)
5. Task 2.4 (ToolHandler)
6. Task 3.1 → 3.2 → 3.3 (API Integration)

### High Priority (важно для функциональности):
7. Task 4.1 → 4.2 (ApprovalDialog)
8. Task 5.1 → 5.2 → 5.3 → 5.4 → 5.5 (Testing)

### Medium Priority (улучшает опыт):
9. Task 4.3 → 4.4 → 4.5 (Additional UI)
10. Task 6.1 → 6.2 (Security & Performance)

### Low Priority (финализация):
11. Task 7.1 → 7.2 → 7.3 (Integration & Finalization)

---

## Acceptance Criteria Summary

**Фаза 1 (Types & Schemas)**: 
- StreamEventSchema обновлена, Zod schemas созданы, types.ts экспортирует все типы

**Фаза 2 (Infrastructure)**:
- PathValidator, FileSystemExecutor, CommandExecutor, ToolHandler реализованы
- Все unit тесты pass (≥95% coverage)

**Фаза 3 (API)**:
- CodeLabAPI, StreamingClient, extension.ts обновлены
- Tool events обрабатываются и маршрутизируются

**Фаза 4 (UI)**:
- ApprovalDialog, ToolProgressBar, ToolStatusView реализованы
- Локализация поддерживается

**Фаза 5 (Testing)**:
- Unit tests для всех компонентов (≥95% coverage)
- Integration tests для approval flow
- React component tests

**Фаза 6 (Security)**:
- Security audit passed
- No vulnerabilities found
- Performance acceptable

**Фаза 7 (Finalization)**:
- All components integrated
- No regressions
- Documentation complete
