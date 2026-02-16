# Agent Selector Schema Fix

## Проблема

При загрузке списка агентов возникала ошибка валидации схемы:
```
Response validation failed: {endpoint: '/my/agents/', errors: Array(3), data: {…}}
[ChatViewProvider] Error loading agents: NetworkError: Network request failed
```

API возвращал агентов с полями `status` и `config`, но схема валидации `AgentResponseSchema` ожидала другую структуру с полем `type` и строгим форматом `datetime` для `created_at`.

## Ответ API

```json
{
  "agents": [
    {
      "id": "78975b4b-697d-4e85-9521-fd73ef297d9e",
      "name": "CodeAssistant",
      "status": "ready",
      "created_at": "2026-02-15T17:45:06.840075Z",
      "config": {
        "name": "CodeAssistant",
        "system_prompt": "You are a helpful coding assistant...",
        "model": "openrouter/openai/gpt-4.1",
        "tools": ["code_search", "file_operations", "terminal"],
        "concurrency_limit": 3,
        "temperature": 0.7,
        "max_tokens": 4096,
        "metadata": {}
      }
    }
  ],
  "total": 3
}
```

## Решение

### 1. Обновлена схема AgentResponseSchema

**Файл:** `src/api/schemas.ts`

```typescript
// Было:
export const AgentResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.string(),
  config: z.record(z.any()),
  created_at: z.string().datetime()
});

// Стало:
export const AgentResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: z.string().optional(),
  created_at: z.string(),
  config: z.record(z.any())
});
```

**Изменения:**
- Удалено поле `type` (не возвращается API)
- Добавлено поле `status` как опциональное
- `created_at` изменен с `.datetime()` на `.string()` для более гибкой валидации

### 2. Обновлен интерфейс Agent

**Файл:** `webview/src/types/index.ts`

```typescript
// Было:
export interface Agent {
  id: string;
  name: string;
  type: string;
  icon?: string;
  description?: string;
  config?: Record<string, any>;
  created_at?: string;
}

// Стало:
export interface Agent {
  id: string;
  name: string;
  status?: string;
  icon?: string;
  description?: string;
  config?: Record<string, any>;
  created_at?: string;
}
```

### 3. Улучшена логика определения иконок

**Файл:** `webview/src/components/AgentSelector.tsx`

Добавлена функция `getAgentIcon()`, которая:
1. Проверяет наличие явной иконки в `agent.icon`
2. Определяет тип агента по имени (CodeAssistant → 💻, DataAnalyst → 📊)
3. Использует иконку по умолчанию 🤖

```typescript
const getAgentIcon = (agent: Agent | null) => {
  if (!agent) return '🤖';
  
  if (agent.icon) return agent.icon;
  
  const name = agent.name.toLowerCase();
  const iconMap: Record<string, string> = {
    'code': '💻',
    'data': '📊',
    'document': '📝',
    'architect': '🏗️',
    'ask': '❓',
    'debug': '🪲',
    'orchestrator': '🪃',
    'default': '🤖'
  };
  
  for (const [key, icon] of Object.entries(iconMap)) {
    if (name.includes(key)) {
      return icon;
    }
  }
  
  return iconMap['default'];
};
```

### 4. Добавлена функция извлечения описания

**Файл:** `webview/src/components/AgentSelector.tsx`

```typescript
const getAgentDescription = (agent: Agent) => {
  if (agent.description) return agent.description;
  
  if (agent.config?.system_prompt) {
    const prompt = agent.config.system_prompt as string;
    return prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt;
  }
  
  return undefined;
};
```

Функция извлекает описание агента:
1. Из явного поля `description`
2. Из `config.system_prompt` (первые 100 символов)
3. Возвращает `undefined` если описания нет

## Результат

После исправлений:
- ✅ Агенты успешно загружаются из API
- ✅ Отображаются в селекторе с правильными иконками
- ✅ Показываются описания из system_prompt
- ✅ Нет ошибок валидации схемы

## Тестирование

1. Запустить расширение (F5)
2. Открыть CodeLab Chat View
3. Проверить наличие агентов в селекторе под полем ввода
4. Убедиться, что агенты отображаются с иконками и описаниями

## Примечания

- Схема теперь более гибкая и соответствует реальному API
- Иконки определяются автоматически по имени агента
- Описания берутся из system_prompt конфигурации агента
