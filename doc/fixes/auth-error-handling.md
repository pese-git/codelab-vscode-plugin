# Исправление обработки ошибок аутентификации

## Проблема

При попытке создать новый чат или отправить сообщение без установленного API токена, пользователь получал непонятную ошибку:
```
Failed to create new chat: APIError: Invalid or expired token
```

Это создавало плохой пользовательский опыт, так как не было понятно, что нужно сделать для решения проблемы.

## Решение

### 1. Улучшена обработка ошибок в ChatViewProvider

**Файл:** `src/ui/ChatViewProvider.ts`

Добавлены вспомогательные методы:
- `isAuthError(error)` - проверяет, является ли ошибка проблемой аутентификации
- `handleAuthError()` - показывает понятное сообщение с кнопкой "Set Token"

Улучшена обработка ошибок в методах:
- `_handleMessage()` - обработка отправки сообщений
- `startNewChat()` - создание нового чата
- `sendInitialState()` - загрузка начального состояния

### 2. Улучшена обработка ошибок в командах

**Файл:** `src/commands/index.ts`

Добавлена функция `handleAPIError()` для централизованной обработки ошибок API.

Все команды, использующие API, теперь обёрнуты в try-catch:
- `codelab.explainSelection`
- `codelab.refactorSelection`
- `codelab.fixErrors`
- `codelab.generateCode`

### 3. Обновлена документация

**Файл:** `QUICKSTART.md`

Добавлен подробный раздел в Troubleshooting об ошибках аутентификации с инструкциями по установке токена.

## Поведение после исправления

### Сценарий 1: Создание нового чата без токена

**До:**
```
Error: Failed to create new chat: APIError: Invalid or expired token
```

**После:**
```
[Диалоговое окно]
API token not set or expired. Please set your CodeLab API token.
[Set Token] [Cancel]
```

При нажатии "Set Token" автоматически открывается команда установки токена.

### Сценарий 2: Отправка сообщения без токена

**До:**
```
Error: [непонятное сообщение об ошибке]
```

**После:**
- Показывается понятное диалоговое окно с предложением установить токен
- В чате отображается: "Authentication required. Please set your API token."

### Сценарий 3: Использование команд без токена

**До:**
```
Error: [ошибка без объяснения]
```

**После:**
```
[Диалоговое окно]
API token not set or expired. Please set your CodeLab API token.
[Set Token] [Cancel]
```

## Технические детали

### Проверка ошибок аутентификации

```typescript
private isAuthError(error: any): boolean {
  return (error instanceof APIError && error.status === 401) || 
         error?.message?.includes('Not authenticated');
}
```

### Обработка ошибок аутентификации

```typescript
private async handleAuthError(): Promise<void> {
  const action = await vscode.window.showErrorMessage(
    'API token not set or expired. Please set your CodeLab API token.',
    'Set Token'
  );
  
  if (action === 'Set Token') {
    await vscode.commands.executeCommand('codelab.setApiToken');
  }
}
```

## Тестирование

Для проверки исправления:

1. Убедитесь, что API токен не установлен:
   - Откройте Command Palette
   - Выполните команду для очистки токена (если есть)

2. Попробуйте создать новый чат:
   - Нажмите кнопку "New Chat"
   - Должно появиться диалоговое окно с предложением установить токен

3. Попробуйте отправить сообщение:
   - Введите текст в чат
   - Нажмите "Send"
   - Должно появиться диалоговое окно с предложением установить токен

4. Попробуйте использовать команды:
   - Выделите код и выполните "Explain Selection"
   - Должно появиться диалоговое окно с предложением установить токен

## Преимущества

1. **Лучший UX**: Пользователь сразу понимает, что нужно сделать
2. **Быстрое решение**: Одна кнопка для установки токена
3. **Централизованная обработка**: Код не дублируется
4. **Понятная документация**: Добавлены инструкции в QUICKSTART.md
5. **Graceful degradation**: При отсутствии токена UI не ломается, а показывает пустое состояние
