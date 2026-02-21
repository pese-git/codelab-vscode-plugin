# Спецификация: Tool Approval Flow

## Описание

User approval workflow для выполнения tools перед их локальным выполнением. Включает ApprovalDialog компонент, risk level индикацию, async approval/rejection handling, audit logging и timeout protection.

## ToolApprovalBlock компонент

Компонент React для встроенного отображения одобрения tool выполнения. Компонент встраивается прямо в message list как inline блок (аналогично RooCode), над полем ввода сообщений.

### Структура компонента (webview/src/components/Tools/ToolApprovalBlock.tsx)

```typescript
interface ToolApprovalBlockProps {
  toolId: string
  toolName: string
  toolDescription?: string
  risk_level: RiskLevel
  args: Record<string, unknown>
  onApprove: () => void
  onReject: (reason?: string) => void
  isProcessing?: boolean
}

export const ToolApprovalBlock: React.FC<ToolApprovalBlockProps> = ({
  toolId,
  toolName,
  toolDescription,
  risk_level,
  args,
  onApprove,
  onReject,
  isProcessing
}) => {
  // Реализация компонента
}
```

### Визуальная структура

Блок встраивается над полем ввода и содержит:

```
┌──────────────────────────────────────────────────┐
│ ⚠️ Tool Approval Required                       │
│                                                  │
│ Tool: read_file                                 │
│ Description: Read workspace file                │
│ Risk Level: [Low] [colored indicator]          │
│                                                  │
│ Arguments: { path: "/src/main.ts" }            │
│                                                  │
│ [✓ Approve]  [✗ Reject]                        │
└──────────────────────────────────────────────────┘

[Input field]
[Send button]
```

### Визуальные элементы

1. **Header**
   - Иконка предупреждения (⚠️) для high/critical
   - Text "Tool Approval Required"
   - Close button (X) - закрывает блок = reject

2. **Tool Information Section (компактный)**
   - Tool: {toolName}
   - Description: {toolDescription} (если есть, одна строка)
   - Risk Level: [inline badge с цветом]
     - Low (зеленый): #4CAF50
     - Medium (оранжевый): #FF9800
     - High (красный): #F44336
     - Critical (черный): #212121

3. **Arguments Display**
   - Arguments: {JSON display в одну строку, truncated если длинно}
   - Onclick expand to full JSON view

4. **Action Buttons (на одной строке)**
   - "Approve" button (primary, синий) - вся ширина или 50%
   - "Reject" button (secondary, серый) - вся ширина или 50%
   - Оба disabled если isProcessing=true

5. **Loading State**
   - Spinner рядом с кнопками
   - Disabled buttons
   - Show "Processing..." text

### Интеграция в Message List

ToolApprovalBlock встраивается в MessageList как специальный message type:

```typescript
// В MessageList компоненте
{message.type === 'tool_approval_request' && (
  <ToolApprovalBlock
    toolId={message.tool_id}
    toolName={message.tool_name}
    toolDescription={message.tool_description}
    risk_level={message.risk_level}
    args={message.args}
    onApprove={handleApprove}
    onReject={handleReject}
  />
)}
```

### Поведение

1. **Показ блока**
   - Когда backend отправляет tool.approval_request
   - Блок автоматически скроллится в view (smooth scroll)
   - Фокус НЕ переходит (пользователь может продолжить читать)

2. **Одобрение**
   - Click "Approve" button
   - Кнопки становятся disabled
   - Show spinner
   - onApprove() callback отправляет approveToolExecution() на backend
   - Блок удаляется из UI после успеха (или показывает ✓ checkmark)

3. **Отклонение**
   - Click "Reject" button или X кнопку
   - Опциональное меню для выбора причины:
     - "User declined"
     - "Looks risky"
     - "Will do it later"
   - onReject(reason) callback отправляет rejectToolExecution() на backend
   - Блок удаляется из UI

4. **Auto-reject на timeout**
   - Если нет одобрения за 5 минут
   - Show countdown timer "Closing in 30s" (в последние 30 сек)
   - Автоматический rejection
   - Блок исчезает с UI

### Стили (webview/src/components/Tools/ToolApprovalBlock.module.css)

```css
.block {
  /* Встроенный блок */
  background: #f5f5f5
  border: 1px solid #e0e0e0
  border-radius: 8px
  padding: 12px 16px
  margin: 12px 0
  gap: 8px
}

.header {
  display: flex
  align-items: center
  gap: 8px
  font-weight: 600
}

.closeButton {
  margin-left: auto
  cursor: pointer
}

.toolInfo {
  display: flex
  flex-direction: column
  gap: 6px
  font-size: 13px
  color: #333
}

.riskBadge {
  display: inline-flex
  align-items: center
  width: fit-content
  padding: 2px 8px
  border-radius: 12px
  font-size: 12px
  font-weight: 500
}

.riskBadge_low { background: #c8e6c9; color: #2e7d32; }
.riskBadge_medium { background: #ffe0b2; color: #ef6c00; }
.riskBadge_high { background: #ffcdd2; color: #c62828; }
.riskBadge_critical { background: #e0e0e0; color: #000; }

.arguments {
  background: #fafafa
  padding: 8px
  border-radius: 4px
  font-family: monospace
  font-size: 12px
  overflow: hidden
  text-overflow: ellipsis
  white-space: nowrap
  cursor: pointer
}

.actions {
  display: flex
  gap: 8px
}

.button {
  flex: 1
  padding: 8px 16px
  border-radius: 6px
  border: none
  cursor: pointer
  font-weight: 500
  transition: all 0.2s
}

.button_approve {
  background: #1976d2
  color: white
}

.button_approve:hover:not(:disabled) {
  background: #1565c0
}

.button_reject {
  background: #e0e0e0
  color: #333
}

.button_reject:hover:not(:disabled) {
  background: #d0d0d0
}

.button:disabled {
  opacity: 0.6
  cursor: not-allowed
}

.loading {
  display: flex
  align-items: center
  gap: 8px
}

.spinner {
  width: 16px
  height: 16px
  animation: spin 1s linear infinite
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.timer {
  font-size: 12px
  color: #666
}
```

## Async Approval Handling

### Request Flow

1. **Backend sends ToolApprovalRequest**
   ```
   SSE Event: tool.approval_request
   {
     tool_id: 'uuid-123',
     tool_name: 'read_file',
     tool_description: 'Read content of workspace file',
     args: { path: '/src/main.ts' },
     risk_level: 'low',
     estimated_duration_ms: 500
   }
   ```

2. **StreamingClient receives event**
   - Парсит и валидирует событие
   - Проверяет что tool_id не в pendingApprovals (no duplicates)
   - Передает ToolHandler.handleToolApprovalRequest()

3. **ToolHandler requests user approval**
   - Создает Promise для ожидания одобрения/отклонения
   - Показывает ApprovalDialog в webview
   - Устанавливает timeout на 5 минут

4. **User interacts with dialog**
   - Approve: вызывает onApprove() callback
   - Reject: вызывает onReject(reason) callback
   - Timeout: auto-reject с причиной "Approval timeout"

5. **ToolHandler receives response**
   - Одобрение: отправляет api.approveToolExecution(tool_id)
   - Отклонение: отправляет api.rejectToolExecution(tool_id, reason)

6. **Backend receives approval/rejection**
   - Обрабатывает approval и отправляет ToolExecutionSignal или завершает
   - Backend может отправить ToolResultAck если отклонено

### Promise-based API

ToolHandler должен иметь метод для ожидания одобрения:

```typescript
private requestUserApproval(
  event: ToolApprovalRequest,
  timeout: number = 300000
): Promise<boolean> {
  return new Promise((resolve) => {
    // Setup UI callback handlers
    const onApprove = () => {
      clearTimeout(timer)
      this.toolApprovalMap.delete(event.tool_id)
      resolve(true)
    }
    
    const onReject = (reason: string) => {
      clearTimeout(timer)
      this.toolApprovalMap.delete(event.tool_id)
      resolve(false)
    }
    
    // Setup timeout
    const timer = setTimeout(() => {
      this.toolApprovalMap.delete(event.tool_id)
      resolve(false) // Auto-reject on timeout
    }, timeout)
    
    // Store resolver for UI callback
    this.toolApprovalMap.set(event.tool_id, {
      request: event,
      timeout: timer,
      resolver: resolve
    })
    
    // Show dialog in webview
    this.dialogProvider.showApprovalDialog(event, onApprove, onReject)
  })
}
```

## API методы

В `src/api/client.ts` нужны три новых метода:

### approveToolExecution(toolId, metadata?)

```typescript
async approveToolExecution(
  toolId: string,
  metadata?: Record<string, unknown>
): Promise<{ status: 'approved' }> {
  const response = await fetch(
    `${this.baseUrl}/sessions/${this.sessionId}/tools/${toolId}/approve`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({
        approved_at: new Date().toISOString(),
        metadata
      })
    }
  )
  
  if (!response.ok) {
    throw new ApiError('Failed to approve tool', response.status)
  }
  
  return response.json()
}
```

### rejectToolExecution(toolId, reason)

```typescript
async rejectToolExecution(
  toolId: string,
  reason: string
): Promise<{ status: 'rejected' }> {
  const response = await fetch(
    `${this.baseUrl}/sessions/${this.sessionId}/tools/${toolId}/reject`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({
        reason,
        rejected_at: new Date().toISOString()
      })
    }
  )
  
  if (!response.ok) {
    throw new ApiError('Failed to reject tool', response.status)
  }
  
  return response.json()
}
```

### sendToolResult(toolId, result)

```typescript
async sendToolResult(
  toolId: string,
  result: ToolExecutionResult
): Promise<{ status: 'received' }> {
  const response = await fetch(
    `${this.baseUrl}/sessions/${this.sessionId}/tools/${toolId}/result`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({
        result,
        received_at: new Date().toISOString()
      })
    }
  )
  
  if (!response.ok) {
    throw new ApiError('Failed to send tool result', response.status)
  }
  
  return response.json()
}
```

## Audit Logging

Все операции одобрения/отклонения должны логироваться для аудита:

### Audit Log Entry

```typescript
interface AuditLogEntry {
  timestamp: string (ISO 8601)
  tool_id: string
  tool_name: string
  action: 'approval_requested' | 'approved' | 'rejected' | 'timeout'
  user_decision?: boolean
  reason?: string
  risk_level: RiskLevel
  approval_duration_ms?: number
}
```

### Логирование в ToolHandler

При каждом событии одобрения:

```typescript
private logAuditEvent(entry: AuditLogEntry) {
  const logMessage = `[AUDIT] ${entry.action} tool=${entry.tool_name} risk=${entry.risk_level} duration=${entry.approval_duration_ms}ms`
  
  if (entry.action === 'rejected') {
    this.logger.info(`${logMessage} reason=${entry.reason}`)
  } else {
    this.logger.info(logMessage)
  }
  
  // TODO: Send to backend audit log endpoint if needed
}
```

Примеры логирования:
- `[AUDIT] approval_requested tool=read_file risk=low`
- `[AUDIT] approved tool=read_file duration=2500ms`
- `[AUDIT] rejected tool=execute_command reason="User declined" risk=high`
- `[AUDIT] timeout tool=write_file duration=300000ms`

## Risk Level Definition

Risk level определяет как опасна операция:

### Low Risk
- `read_file` с файлами < 1MB
- `list_directory` с paths < 100 entries
- Примеры: просмотр исходного кода

### Medium Risk
- `read_file` с файлами > 1MB
- `list_directory` с paths > 100 entries
- `execute_command` с read-only командами (ls, cat, find)
- Примеры: чтение большого файла, выполнение ls

### High Risk
- `write_file` операции
- `execute_command` с write командами (mkdir, touch, rm)
- Примеры: модификация файлов, создание/удаление файлов

### Critical Risk
- `execute_command` с опасными командами (если somehow in whitelist)
- `write_file` в критические файлы (.git, .env, package.json)
- Примеры: модификация конфигурационных файлов

Risk level должен определяться backend в ToolApprovalRequest и передаваться клиенту.

## Dialog Localization

ApprovalDialog должен поддерживать i18n для интернационализации:

```typescript
// webview/src/i18n/messages.ts
export const approvalDialogMessages = {
  title: 'Tool Execution Request',
  toolLabel: 'Tool',
  descriptionLabel: 'Description',
  riskLevelLabel: 'Risk Level',
  riskLevel_low: 'Low',
  riskLevel_medium: 'Medium',
  riskLevel_high: 'High',
  riskLevel_critical: 'Critical',
  estimatedDurationLabel: 'Estimated Duration',
  argumentsLabel: 'Arguments',
  approveButton: 'Approve',
  rejectButton: 'Reject',
  processingMessage: 'Processing your decision...',
  timeoutWarning: 'Request will auto-reject in {seconds} seconds',
  rejectReasons: [
    'User declined',
    'Looks risky',
    'Will do it later',
    'Other'
  ]
}
```

## Тестирование (webview/src/components/Tools/__tests__/ApprovalDialog.test.tsx)

### Unit тесты

1. **Rendering**
   - Dialog not shown when isOpen=false
   - Dialog shown when isOpen=true
   - Tool info displayed correctly
   - Risk level indicator shows correct color
   - Action buttons rendered

2. **Risk Level Indicator**
   - Low risk показывает зеленый
   - Medium risk показывает оранжевый
   - High risk показывает красный
   - Critical risk показывает черный

3. **User Interactions**
   - Click Approve button calls onApprove()
   - Click Reject button calls onReject()
   - ESC key calls onReject()
   - Click outside does NOT close dialog

4. **Loading State**
   - Buttons disabled when isLoading=true
   - Spinner shown when isLoading=true
   - onApprove/onReject still callable

5. **Timeout**
   - Countdown timer starts
   - Auto-rejects after timeout
   - User can reject before timeout

## Integration Tests (src/tools/__tests__/approval-flow.test.ts)

1. **End-to-end approval flow**
   - ToolApprovalRequest received
   - Dialog shown
   - User approves
   - approveToolExecution() sent to backend
   - Backend receives approval

2. **End-to-end rejection flow**
   - ToolApprovalRequest received
   - Dialog shown
   - User rejects
   - rejectToolExecution() sent to backend
   - Backend receives rejection

3. **Timeout scenario**
   - ToolApprovalRequest received
   - Dialog shown
   - Wait for timeout
   - Auto-reject happens
   - Backend receives rejection with timeout reason

## Acceptance Criteria

- [ ] ApprovalDialog компонент реализован с correct визуальной иерархией
- [ ] Risk level indicator показывает correct colors
- [ ] Async approval handling работает через Promises
- [ ] Three API методы (approveToolExecution, rejectToolExecution, sendToolResult) реализованы
- [ ] Audit logging логирует все операции
- [ ] Timeout protection (5 min) работает
- [ ] Dialog закрывается корректно после одобрения/отклонения
- [ ] ESC key and outside click handled правильно
- [ ] Локализация поддерживается
- [ ] Unit и integration тесты покрывают все сценарии (≥85%)
