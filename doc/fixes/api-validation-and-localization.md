# Исправление валидации API и добавление локализации

**Дата:** 2026-02-20  
**Автор:** CodeLab Team

## Проблема

При загрузке агентов из API возникали ошибки валидации:
- `ValidationError: agents.X.config.name: Required`
- Ошибки оборачивались в `NetworkError`, затрудняя диагностику
- Отсутствовала локализация сообщений об ошибках

## Анализ

### Источник проблемы
Backend API возвращает структуру агента с полем `name` на верхнем уровне:
```json
{
  "id": "...",
  "name": "Architect",
  "status": "ready",
  "config": {
    "system_prompt": "...",
  }
}
```

Но схема `AgentConfigSchema` требовала поле `name` внутри `config`.

## Решение

### 1. Исправлена схема AgentConfig
**Файл:** [`src/api/schemas.ts`](../../src/api/schemas.ts)

- Удалено обязательное поле `name` из `AgentConfigSchema`
- Добавлено опциональное поле `metadata`
- Поле `name` остается на верхнем уровне в `AgentResponseSchema`

Ключевые изменения:
```typescript
// Было:
export const AgentConfigSchema = z.object({
  name: z.string(),
  // ...
});

// Стало:
export const AgentConfigSchema = z.object({
  system_prompt: z.string(),
  metadata: z.record(z.unknown()).optional(),
  // name удалено из config
});
```

### 2. Улучшена обработка ValidationError
**Файл:** [`src/api/client.ts`](../../src/api/client.ts)

- Добавлена проверка `instanceof ValidationError` перед оборачиванием в `NetworkError`
- ValidationError теперь пробрасывается напрямую для корректной диагностики
- Другие ошибки по-прежнему оборачиваются в `NetworkError`

Изменение в методе `parseData()`:
```typescript
if (error instanceof ValidationError) {
  throw error; // Пробросить ValidationError напрямую
}
throw new NetworkError(error instanceof Error ? error.message : String(error));
```

### 3. Добавлено детальное логирование
**Файл:** [`src/ui/ChatViewProvider.ts`](../../src/ui/ChatViewProvider.ts)

- Специальная обработка ValidationError с вызовом `error.getDetails()`
- Уведомление пользователя о проблемах с загрузкой агентов через `vscode.window.showWarningMessage()`
- Graceful degradation - отправка пустого списка при ошибке загрузки

Обработка ValidationError:
```typescript
if (error instanceof ValidationError) {
  console.warn('[ChatViewProvider] ValidationError loading agents:', error.getDetails());
  vscode.window.showWarningMessage(
    t('error.agent_loading', { error: error.message })
  );
  // Отправить пустой список агентов
  this.webview?.postMessage({
    type: 'agents',
    agents: []
  });
}
```

### 4. Создана система локализации
**Файлы:** 
- [`src/i18n/messages.ts`](../../src/i18n/messages.ts)
- [`src/i18n/index.ts`](../../src/i18n/index.ts)

Особенности реализации:
- Функция `t()` для получения локализованных сообщений
- Поддержка английского (en) и русского (ru) языков
- Автоматическое определение языка на основе `vscode.env.language`
- Подстановка параметров в сообщения через шаблоны `{paramName}`
- Fallback на английский для неизвестных языков

Использование:
```typescript
import { t } from '../i18n';

// Простое сообщение
const msg = t('error.validation');

// С параметрами
const msg = t('error.agent_loading', { error: 'Network timeout' });
```

Доступные сообщения:
- `error.validation` - Ошибка валидации данных
- `error.network` - Сетевая ошибка
- `error.agent_loading` - Ошибка при загрузке агентов
- `warning.agents_unavailable` - Агенты недоступны
- `info.system_language` - Язык системы
- `agent.status.ready` - Статус "Готов"
- `agent.status.loading` - Статус "Загрузка"
- `agent.status.error` - Статус "Ошибка"

## Результат

✅ Агенты загружаются без ошибок валидации  
✅ ValidationError корректно обрабатывается и логируется  
✅ Пользователь получает понятные уведомления об ошибках на русском языке  
✅ Все сообщения об ошибках локализованы  
✅ Graceful degradation обеспечивает стабильность приложения

## Тестирование

- [x] TypeScript компиляция без ошибок
- [x] Linting без предупреждений
- [x] Проверка типов успешна
- [x] Схема валидации соответствует API
- [x] Локализация работает корректно
- [x] ValidationError правильно обрабатывается
- [x] Сообщения об ошибках отображаются пользователю

## Влияние на код

### Файлы, затронутые исправлением:
1. `src/api/schemas.ts` - исправлена схема AgentConfigSchema
2. `src/api/client.ts` - улучшена обработка ошибок
3. `src/ui/ChatViewProvider.ts` - добавлено логирование и локализация
4. `src/i18n/messages.ts` - новый файл с локализованными сообщениями
5. `src/i18n/index.ts` - новый файл с функцией локализации

### API совместимость:
- ✅ Полная совместимость с текущим API
- ✅ Обратная совместимость сохранена
- ✅ Нет нарушений контрактов

## Дальнейшие улучшения

Возможные направления развития:
- Добавить локализацию для дополнительных языков (испанский, французский и т.д.)
- Использовать систему локализации в других компонентах UI
- Добавить тестирование всех путей обработки ValidationError
- Реализовать логирование в файл для отладки
