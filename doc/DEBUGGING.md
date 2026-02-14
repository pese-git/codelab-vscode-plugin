# Руководство по отладке CodeLab Extension

## Включение логов разработчика

### 1. Открыть Developer Tools

**Способ 1:** Через меню
- `Help` → `Toggle Developer Tools`

**Способ 2:** Горячие клавиши
- macOS: `Cmd + Option + I`
- Windows/Linux: `Ctrl + Shift + I`

### 2. Просмотр логов

В консоли Developer Tools вы увидите:
- Ошибки валидации с деталями
- Сетевые ошибки
- API ошибки
- Состояние подключений

## Типы ошибок

### ValidationError

Возникает когда ответ от API не соответствует ожидаемой схеме.

**Пример лога:**
```
Response validation failed: {
  endpoint: '/my/chat/sessions/',
  errors: [
    {
      code: 'invalid_type',
      expected: 'string',
      received: 'undefined',
      path: ['id'],
      message: 'Required'
    }
  ],
  data: { invalid: 'data' }
}
```

**Что делать:**
1. Проверьте, что API возвращает правильный формат данных
2. Убедитесь, что версия API совместима с расширением
3. Проверьте схемы в `src/api/schemas.ts`

### APIError

Ошибки HTTP от сервера (4xx, 5xx).

**Пример:**
```
API error (401): Not authenticated
API error (500): Internal server error
```

**Что делать:**
- **401 Unauthorized**: Проверьте API токен (`Cmd/Ctrl + Shift + P` → "CodeLab: Set API Token")
- **403 Forbidden**: Проверьте права доступа
- **404 Not Found**: Проверьте URL API в настройках
- **500 Server Error**: Проблема на стороне сервера

### NetworkError

Проблемы с сетевым подключением.

**Примеры:**
```
Network error: Request timeout
Network error: Failed to fetch
```

**Что делать:**
1. Проверьте интернет-соединение
2. Проверьте, что API сервер доступен
3. Проверьте настройки прокси/VPN
4. Увеличьте timeout в настройках

## Отладка конкретных проблем

### Проблема: "Failed after 3 attempts: Response validation failed"

**Причина:** ValidationError при повторных попытках запроса

**Решение:**
1. Откройте Developer Tools
2. Найдите лог "Response validation failed:" с деталями
3. Проверьте, какие поля отсутствуют или имеют неправильный тип
4. Обновите схему или исправьте API

### Проблема: "Not authenticated"

**Причина:** Отсутствует или истек API токен

**Решение:**
1. `Cmd/Ctrl + Shift + P`
2. Введите "CodeLab: Set API Token"
3. Вставьте ваш API токен
4. Попробуйте снова

### Проблема: WebSocket ошибки

**Пример:**
```
[SocketTransport] on(connect_error): websocket error
```

**Причина:** Проблемы с подключением к streaming API

**Решение:**
1. Проверьте, что WebSocket endpoint доступен
2. Проверьте настройки firewall
3. Проверьте, что токен валиден

## Настройки для отладки

### Увеличение timeout

В `src/api/config.ts`:
```typescript
export function getAPIConfig(): APIConfig {
  return {
    baseUrl: vscode.workspace.getConfiguration('codelab').get('apiUrl', 'http://localhost:8000'),
    timeout: 60000, // Увеличьте с 30000 до 60000
    retryAttempts: 3
  };
}
```

### Включение подробных логов

Добавьте в начало `src/api/client.ts`:
```typescript
const DEBUG = true;

private async request<T>(...) {
  if (DEBUG) {
    console.log('Request:', { endpoint, options });
  }
  // ...
}
```

## Сбор информации для bug report

При создании issue включите:

1. **Версия расширения**: Из `package.json`
2. **Версия VS Code**: `Help` → `About`
3. **Логи из Developer Tools**: Скопируйте релевантные ошибки
4. **Шаги для воспроизведения**: Подробное описание
5. **Ожидаемое поведение**: Что должно было произойти
6. **Фактическое поведение**: Что произошло на самом деле

## Полезные команды

### Очистка состояния расширения

```javascript
// В Developer Tools Console
vscode.commands.executeCommand('workbench.action.reloadWindow')
```

### Проверка сохраненного токена

```javascript
// В Developer Tools Console (только для отладки!)
// НЕ делитесь этим выводом публично!
vscode.workspace.getConfiguration('codelab').get('apiToken')
```

### Очистка сессии

```javascript
// В Developer Tools Console
vscode.commands.executeCommand('codelab.clearSession')
```

## Тестирование

### Запуск unit тестов

```bash
npm test
```

### Запуск в режиме разработки

1. Откройте проект в VS Code
2. Нажмите `F5` или `Run` → `Start Debugging`
3. Откроется новое окно VS Code с расширением
4. В оригинальном окне будут видны логи

## Дополнительные ресурсы

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Zod Documentation](https://zod.dev/)
- [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
