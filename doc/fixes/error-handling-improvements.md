# Улучшения обработки ошибок

## Дата: 2026-02-14

## Проблемы

1. **ValidationError терялась в withRetry**: Функция `withRetry` оборачивала оригинальную ошибку в новый `Error`, теряя информацию о типе и деталях валидации
2. **Отсутствие Content-Type заголовка**: Запросы не содержали `Content-Type: application/json`
3. **Недостаточное логирование**: Сложно было отследить причину ошибок валидации
4. **Плохая обработка ошибок в UI**: Пользователь получал неинформативные сообщения об ошибках

## Исправления

### 1. ValidationError с деталями (src/api/errors.ts)

```typescript
export class ValidationError extends Error {
  constructor(
    message: string,
    public zodError: z.ZodError
  ) {
    // Добавляем детали ошибок валидации в сообщение
    super(`${message}: ${zodError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    this.name = 'ValidationError';
  }
  
  // Метод для получения полных деталей
  getDetails(): string {
    return JSON.stringify(this.zodError.errors, null, 2);
  }
}
```

### 2. Исправление withRetry (src/api/errors.ts)

**Было:**
```typescript
throw new Error(
  `Failed after ${maxAttempts} attempts: ${lastError?.message || 'Unknown error'}`
);
```

**Стало:**
```typescript
// Не retry ValidationError - это ошибка данных, не сети
if (error instanceof ValidationError) {
  throw error;
}

// Пробрасываем оригинальную ошибку вместо создания новой
throw lastError || new Error('Unknown error after retry');
```

### 3. Content-Type заголовок (src/api/client.ts)

```typescript
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  ...this.authManager.getAuthHeaders(token),
  ...(options.headers as Record<string, string> || {})
};
```

### 4. Улучшенная обработка ошибок ответа (src/api/client.ts)

```typescript
if (!response.ok) {
  let errorMessage = 'Unknown error';
  let errorCode = 'UNKNOWN';
  
  try {
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const error: any = await response.json();
      errorMessage = error.detail || error.message || errorMessage;
      errorCode = error.error_code || error.code || errorCode;
    } else {
      errorMessage = await response.text() || errorMessage;
    }
  } catch {
    // Игнорируем ошибки парсинга
  }
  
  throw new APIError(response.status, errorCode, errorMessage);
}
```

### 5. Логирование ValidationError (src/api/client.ts)

```typescript
if (schema) {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Response validation failed:', {
        endpoint,
        errors: error.errors,
        data
      });
      throw new ValidationError('Response validation failed', error);
    }
    throw error;
  }
}
```

### 6. Улучшенная обработка в UI (src/ui/ChatViewProvider.ts)

```typescript
} catch (error: any) {
  console.error('Error sending message:', error);
  
  if (this.isAuthError(error)) {
    await this.handleAuthError();
    this.postMessage({
      type: 'error',
      payload: { message: 'Authentication required. Please set your API token.' }
    });
  } else if (error instanceof ValidationError) {
    console.error('Validation error details:', error.getDetails());
    this.postMessage({
      type: 'error',
      payload: { message: `Validation error: ${error.message}` }
    });
    vscode.window.showErrorMessage(`Validation error: ${error.message}`);
  } else if (error instanceof NetworkError) {
    this.postMessage({
      type: 'error',
      payload: { message: `Network error: ${error.message}` }
    });
  } else if (error instanceof APIError) {
    this.postMessage({
      type: 'error',
      payload: { message: `API error (${error.status}): ${error.message}` }
    });
  } else {
    this.postMessage({
      type: 'error',
      payload: { message: `Error: ${error.message || String(error)}` }
    });
  }
}
```

## Результаты

1. ✅ ValidationError теперь правильно пробрасывается через withRetry
2. ✅ Все запросы содержат правильный Content-Type заголовок
3. ✅ Детальное логирование ошибок валидации в консоль
4. ✅ Пользователь получает понятные сообщения об ошибках
5. ✅ Разные типы ошибок обрабатываются по-разному

## Тестирование

Для проверки исправлений:

1. Запустите расширение в режиме разработки
2. Откройте Developer Tools (Help > Toggle Developer Tools)
3. Попробуйте отправить сообщение
4. Проверьте логи в консоли на наличие детальной информации об ошибках

## Дополнительные улучшения

В будущем можно добавить:
- Telemetry для отслеживания частоты ошибок
- Retry с экспоненциальной задержкой для сетевых ошибок
- Кэширование успешных ответов
- Offline режим с очередью запросов
