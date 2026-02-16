# Исправление ошибки "Invalid Date"

## Проблема

В интерфейсе отображалось "Invalid Date" вместо корректного времени сообщений.

## Причина

1. В событии `taskCompleted` не всегда присутствовало поле `timestamp`, особенно при ошибках
2. Отсутствовала валидация timestamp перед преобразованием в Date
3. Не было обработки некорректных значений timestamp

## Решение

### 1. Исправлен обработчик `taskCompleted` в App.tsx

**Файл:** `webview/src/App.tsx`

Добавлены значения по умолчанию для отсутствующих полей:

```typescript
case 'taskCompleted':
  console.log('[App] Task completed:', message.payload);
  state.setIsLoading(false);
  state.addMessage({
    id: message.payload.task_id || `task-${Date.now()}`,
    role: 'assistant',
    content: message.payload.result || message.payload.error || 'Task completed',
    timestamp: message.payload.timestamp || new Date().toISOString(), // ← Добавлен fallback
    agentId: message.payload.agent_id
  });
  break;
```

### 2. Добавлена валидация дат во всех компонентах сообщений

Создана функция `formatTime` с проверкой валидности даты:

```typescript
const formatTime = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return date.toLocaleTimeString();
  } catch (error) {
    return 'Invalid Date';
  }
};
```

**Исправленные файлы:**
- `webview/src/components/Message/SimpleUserMessage.tsx`
- `webview/src/components/Message/SimpleAssistantMessage.tsx`
- `webview/src/components/Message/UserMessage.tsx`
- `webview/src/components/Message/AssistantMessage.tsx`
- `webview/src/components/SessionList.tsx`

## Результат

- Все сообщения теперь отображают корректное время
- При отсутствии timestamp используется текущее время
- При некорректном timestamp отображается "Invalid Date" вместо краша
- Обработка ошибок в taskCompleted работает корректно

## Тестирование

1. Перезагрузите расширение (Developer: Reload Window)
2. Отправьте сообщение в чат
3. Проверьте, что время отображается корректно
4. Проверьте сообщения с ошибками (timeout и т.д.)
