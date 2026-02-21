# Архитектура CodeLab VS Code Plugin

## Обзор

CodeLab - это VS Code расширение, реализующее thin client архитектуру для AI-ассистента разработчика. Плагин не содержит AI-логики и выступает в роли интерфейса между пользователем и backend сервисом.

## Технологический стек

### Core Technologies
- **TypeScript 5.9+** - строгая типизация, ES2022+ features
- **VS Code Extension API 1.109+** - последняя стабильная версия
- **Node.js 22.x** - LTS с современными возможностями

### Build Tools
- **esbuild 0.27+** - быстрый bundler для extension (CJS format)
- **Vite 5.x** - современный bundler для WebView UI
- **npm-run-all** - параллельный запуск задач

### Code Quality
- **ESLint 9.x** - линтинг с flat config
- **typescript-eslint 8.x** - TypeScript правила
- **Prettier 3.x** - форматирование кода
- **Vitest** - быстрый test runner
- **husky + lint-staged** - pre-commit hooks

### UI Framework
- **React 18.3+** - UI с concurrent features
- **CSS Modules** - изолированные стили
- **marked 14.x** - безопасный markdown rendering
- **highlight.js 11.x** - syntax highlighting
- **@tanstack/react-virtual** - виртуализация списков

### Type Safety & Validation
- **Zod** - runtime валидация с type inference
- **TypeScript strict mode** - максимальная строгость

## Архитектурные принципы

### 1. Thin Client Architecture

```
┌─────────────────────────────────────┐
│     VS Code Plugin (Thin Client)    │
│                                     │
│  ┌──────────┐  ┌─────────────────┐ │
│  │ WebView  │  │ Context         │ │
│  │ UI       │  │ Collector       │ │
│  │ (React)  │  │                 │ │
│  └──────────┘  └─────────────────┘ │
│                                     │
│  ┌──────────┐  ┌─────────────────┐ │
│  │ REST +   │  │ Diff/Apply      │ │
│  │ Streaming│  │ Engine          │ │
│  │ Client   │  │                 │ │
│  └──────────┘  └─────────────────┘ │
│                                     │
│  ┌──────────────────────────────┐  │
│  │ LSP Client                   │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
              │
              │ REST + Streaming Fetch
              ▼
┌─────────────────────────────────────┐
│   Backend AI Orchestrator           │
│                                     │
│  ┌──────────┐  ┌─────────────────┐ │
│  │ LLM      │  │ Prompt          │ │
│  │ Gateway  │  │ Orchestrator    │ │
│  └──────────┘  └─────────────────┘ │
│                                     │
│  ┌──────────┐  ┌─────────────────┐ │
│  │ Memory/  │  │ Tool            │ │
│  │ RAG      │  │ Executor        │ │
│  └──────────┘  └─────────────────┘ │
└─────────────────────────────────────┘
```

### 2. Разделение ответственности

**Плагин отвечает за:**
- UI (React WebView с чатом)
- Сбор контекста проекта
- Коммуникацию с backend (REST + Streaming Fetch API)
- Применение изменений в код
- LSP интеграцию

**Backend отвечает за:**
- AI обработку запросов
- Генерацию кода
- Создание diff
- Управление памятью/контекстом
- Оркестрацию агентов

## Компоненты плагина

### 1. Extension Entry Point (`extension.ts`)

Точка входа расширения, регистрирует:
- Команды VS Code
- WebView Provider
- LSP Client
- Event handlers

**Требования:**
- Активация ≤ 100ms
- Graceful error handling
- Cleanup при деактивации
- Lazy loading компонентов

### 2. UI Layer (`ui/`)

#### ChatViewProvider
- Управляет React WebView в Sidebar
- Обрабатывает сообщения между WebView и extension
- Управляет состоянием чата
- Интегрируется с API client

#### WebView (React App)
- React 18 с TypeScript
- Markdown rendering для сообщений
- Code blocks с подсветкой синтаксиса
- Streaming UI (постепенный вывод через Streaming Fetch API)
- Кнопки действий (Apply, Copy, Retry)

**Требования:**
- WebView load ≤ 200ms
- CSP (Content Security Policy)
- No `eval()` или inline scripts
- Sandbox mode
- Vite для bundling

### 3. Context Collector (`context/`)

Собирает контекст для отправки в backend:

```typescript
interface ProjectContext {
  activeFile?: {
    path: string;
    content: string;
    languageId: string;
    selection?: {
      start: Position;
      end: Position;
      text: string;
    };
  };
  workspaceFiles?: string[];
  diagnostics?: Diagnostic[];
  symbols?: DocumentSymbol[];
}
```

**Источники контекста:**
- Активный редактор
- Выделенный текст
- Workspace файлы (с лимитами)
- LSP diagnostics
- Document symbols

**Оптимизация:**
- Кэширование workspace файлов
- Incremental collection
- Лимиты на размер (1MB файл, 10MB общий)

### 4. API Client (`api/`)

#### REST Client
Для одиночных запросов:
- Создание сессий
- Получение истории
- Управление агентами
- Отправка сообщений

**Технологии:**
- Fetch API (нативный)
- AbortController для отмены
- Zod для валидации ответов
- Typed errors

#### Streaming Client
Для streaming ответов через **Streaming Fetch API**:
- Подключение к streaming endpoint
- Чтение ReadableStream
- Обработка событий (task_started, task_completed, error)
- Reconnect логика с exponential backoff

**Технологии:**
- Fetch API с ReadableStream
- TextDecoder для декодирования chunks
- AbortController для отмены
- Event-based protocol

**Требования:**
- Timeout handling
- Retry с exponential backoff
- Graceful degradation при недоступности
- Typed message protocol

### 5. Diff Engine (`diff/`)

Обработка изменений кода:

```typescript
interface DiffOperation {
  type: 'unified-diff';
  filePath: string;
  diff: string;
}
```

**Процесс:**
1. Backend возвращает unified diff
2. Плагин парсит diff
3. Показывает preview пользователю
4. При подтверждении применяет через `WorkspaceEdit`

**Требования:**
- Запрещено прямое изменение текста
- Обязательное подтверждение пользователя
- Поддержка отмены (undo)
- Валидация diff перед применением
- Multi-file support

### 6. Internationalization Module (`i18n/`)

Система локализации для поддержки нескольких языков интерфейса.

**Расположение:** `src/i18n/`

**Основные компоненты:**

```typescript
// src/i18n/messages.ts - словари сообщений
export const messages = {
  en: {
    errors: { ... },
    info: { ... }
  },
  ru: {
    errors: { ... },
    info: { ... }
  }
};

// src/i18n/index.ts - функция для получения переводов
export function t(key: string, params?: Record<string, any>): string
```

**Возможности:**
- **Функция `t()`** - получение локализованных сообщений с поддержкой параметров
- **Автоматическое определение языка** - на основе `vscode.env.language`
- **Поддерживаемые языки:** английский (en), русский (ru)
- **Подстановка параметров:** `t('errors.apiError', { status: 401, message: 'Unauthorized' })`

**Использование в коде:**

```typescript
import { t } from '../i18n';

// Простое использование
vscode.window.showErrorMessage(t('errors.connectionFailed'));

// С параметрами
const message = t('errors.apiError', { 
  status: error.status, 
  message: error.message 
});
```

**Структура словарей:**

```typescript
{
  en: {
    errors: {
      authRequired: '...',
      validationError: '...',
      networkError: '...',
      apiError: '...',
      sessionNotFound: '...',
      agentsLoadFailed: '...'
    },
    info: {
      connected: '...',
      sessionCreated: '...',
      codeCopied: '...'
    }
  },
  ru: {
    // Русские переводы всех сообщений
  }
}
```

### 7. LSP Integration (`lsp/`)

Интеграция с Language Server Protocol:

**Получаемые данные:**
- Diagnostics (ошибки, предупреждения)
- Document symbols
- Semantic tokens
- Hover information

**Использование:**
- Передача в backend как контекст
- Команда "Fix Errors" использует diagnostics
- Улучшение качества AI ответов

### 7. Commands (`commands/`)

Регистрируемые команды:

```typescript
const commands = [
  'codelab.openChat',
  'codelab.explainSelection',
  'codelab.refactorSelection',
  'codelab.fixErrors',
  'codelab.generateCode'
];
```

**Доступность:**
- Command Palette (Ctrl+Shift+P)
- Context Menu (правый клик в редакторе)
- Keybindings (настраиваемые)

## Потоки данных

### 1. Отправка сообщения

```
User Input (React WebView)
  │
  ├─> ChatViewProvider
  │     │
  │     ├─> Context Collector (собирает контекст)
  │     │
  │     └─> API Client
  │           │
  │           └─> POST /api/chat/message
  │                 │
  │                 └─> Backend
```

### 2. Получение streaming ответа

```
Backend
  │
  └─> Streaming Fetch API
        │
        └─> ReadableStream
              │
              ├─> chunk: task_started
              ├─> chunk: progress_update
              ├─> chunk: task_completed
              │
              └─> Streaming Client
                    │
                    └─> ChatViewProvider
                          │
                          └─> React WebView (отображение)
```

### 3. Применение изменений

```
Backend (unified diff)
  │
  └─> Streaming/REST
        │
        └─> Diff Engine
              │
              ├─> Parse diff
              ├─> Show preview (VS Code Diff Editor)
              │
              └─> User confirms
                    │
                    └─> WorkspaceEdit.apply()
```

## Безопасность

### 1. WebView Security

```typescript
const webview = vscode.window.createWebviewPanel(
  'codelab.chat',
  'CodeLab',
  vscode.ViewColumn.One,
  {
    enableScripts: true,
    localResourceRoots: [extensionUri],
    // CSP настроен в HTML
  }
);
```

**Content Security Policy:**
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'none'; 
               script-src ${webview.cspSource}; 
               style-src ${webview.cspSource} 'unsafe-inline'; 
               img-src ${webview.cspSource} https:;
               connect-src ${webview.cspSource} https:;">
```

### 2. Хранение токенов

```typescript
// Использовать SecretStorage
const token = await context.secrets.get('codelab.apiToken');
await context.secrets.store('codelab.apiToken', newToken);
```

**Запрещено:**
- Хранение в settings.json
- Хранение в plaintext файлах
- Логирование токенов

### 3. Валидация данных

- Валидация всех входных данных от WebView через Zod
- Санитизация путей файлов
- Проверка размеров контекста
- Rate limiting на стороне клиента

## Производительность

### 1. Startup Optimization

- Lazy loading компонентов
- Отложенная активация LSP
- Минимальная инициализация при старте
- Async initialization

**Цель:** ≤ 100ms

### 2. WebView Loading

- Минимальный bundle size (Vite code splitting)
- Lazy loading UI компонентов
- React.lazy для динамических импортов
- CSS Modules для изоляции стилей

**Цель:** ≤ 200ms

### 3. Context Collection

- Лимиты на размер контекста
- Incremental collection
- Кэширование workspace файлов
- Debouncing для частых операций

**Лимиты:**
- Один файл: ≤ 1MB
- Общий контекст: ≤ 10MB
- Количество файлов: ≤ 100

### 4. React Performance

- React.memo для компонентов
- useMemo/useCallback для оптимизации
- Virtual scrolling для больших списков (@tanstack/react-virtual)
- Debouncing для input

## Обработка ошибок

### 1. Network Errors

```typescript
try {
  const response = await apiClient.sendMessage(message);
} catch (error) {
  if (error instanceof NetworkError) {
    // Retry с backoff
    await retryWithBackoff(() => apiClient.sendMessage(message));
  } else if (error instanceof ValidationError) {
    // Показать ошибку валидации
    showErrorMessage(error.message);
  } else {
    // Неизвестная ошибка
    logError(error);
    showErrorMessage('Unexpected error occurred');
  }
}
```

### 2. Streaming Reconnection

```typescript
async function connectStream() {
  try {
    const response = await fetch(streamUrl, {
      signal: abortController.signal
    });
    
    const reader = response.body.getReader();
    await readStream(reader);
  } catch (error) {
    // Exponential backoff
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    setTimeout(() => connectStream(), delay);
  }
}
```

### 3. Typed Errors

```typescript
class APIError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

class ValidationError extends Error {
  constructor(
    public field: string,
    message: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

### 4. Graceful Degradation

- Streaming недоступен → fallback на REST polling
- Backend недоступен → показать статус offline
- Timeout → показать retry опцию
- Partial failure → показать что удалось

## Расширяемость

### 1. Plugin Architecture

Возможность добавления:
- Новых команд через contribution points
- Кастомных context providers
- Дополнительных UI панелей
- Интеграций с другими расширениями

### 2. Configuration

```json
{
  "codelab.api.baseUrl": "http://localhost:8000",
  "codelab.api.timeout": 30000,
  "codelab.maxContextSize": 10485760,
  "codelab.enableLSP": true,
  "codelab.streamingEnabled": true
}
```

## Тестирование

### 1. Unit Tests (Vitest)
- Тестирование отдельных компонентов
- Mock API responses
- Mock VS Code API
- Coverage ≥ 80%

### 2. Integration Tests
- Тестирование взаимодействия компонентов
- E2E тесты с WebView
- LSP интеграция
- Streaming communication

### 3. React Component Tests
- @testing-library/react
- User interaction testing
- Snapshot testing
- Accessibility testing

### 4. Manual Testing
- Тестирование в Extension Development Host (F5)
- Проверка производительности
- UI/UX тестирование

## Deployment

### 1. Packaging

```bash
npm run package
# Создает .vsix файл через vsce
```

### 2. Publishing

- VS Code Marketplace
- Open VSX Registry
- GitHub Releases

### 3. Updates

- Автоматические обновления через VS Code
- Changelog в CHANGELOG.md
- Semantic versioning (semver)

## Best Practices

### 1. TypeScript
- Strict mode enabled
- No `any` types (use `unknown`)
- Explicit return types для public API
- Zod для runtime валидации

### 2. React
- Functional components only
- Hooks для state management
- React.memo для оптимизации
- Custom hooks для переиспользования логики

### 3. Error Handling
- Typed errors (never throw strings)
- Try-catch на границах
- Graceful degradation
- User-friendly error messages

### 4. Performance
- Lazy loading
- Code splitting
- Memoization
- Virtual scrolling для больших списков

### 5. Security
- CSP для WebView
- SecretStorage для токенов
- Input validation
- Path sanitization

### 6. Streaming Fetch API
- ReadableStream для streaming
- TextDecoder для декодирования
- AbortController для отмены
- Reconnect с exponential backoff
