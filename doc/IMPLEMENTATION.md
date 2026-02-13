# CodeLab VS Code Plugin - Implementation Guide

## Обзор реализации

Плагин CodeLab реализован согласно спецификациям в `openspec/specs/` с использованием современного технологического стека.

## Архитектура

### Структура проекта

```
codelab-vscode-plugin/
├── src/
│   ├── api/                    # API клиент и интеграция
│   │   ├── schemas.ts          # Zod схемы для валидации
│   │   ├── config.ts           # Конфигурация API
│   │   ├── auth.ts             # Управление токенами
│   │   ├── client.ts           # REST API клиент
│   │   ├── streaming.ts        # Streaming Fetch API клиент
│   │   ├── errors.ts           # Типизированные ошибки
│   │   ├── index.ts            # Главный API класс
│   │   └── __tests__/          # Тесты
│   ├── context/                # Сбор контекста
│   │   └── collector.ts        # ContextCollector класс
│   ├── commands/               # VS Code команды
│   │   └── index.ts            # Регистрация команд
│   ├── diff/                   # Diff engine
│   │   └── engine.ts           # Применение изменений
│   ├── ui/                     # UI компоненты
│   │   └── ChatViewProvider.ts # WebView provider
│   └── extension.ts            # Точка входа
├── resources/                  # Ресурсы
│   └── icon.svg               # Иконка плагина
├── openspec/                   # Спецификации
│   └── specs/                 # Детальные спецификации
└── doc/                       # Документация
```

## Реализованные компоненты

### 1. API Client (`src/api/`)

#### REST API Client
- **Файл**: `src/api/client.ts`
- **Класс**: `APIClient`
- **Функции**:
  - Создание и управление сессиями
  - Отправка сообщений
  - Получение истории
  - Управление агентами
- **Особенности**:
  - Zod валидация всех запросов/ответов
  - Автоматический retry с exponential backoff
  - Timeout handling
  - Типизированные ошибки

#### Streaming Client
- **Файл**: `src/api/streaming.ts`
- **Класс**: `StreamingClient`
- **Функции**:
  - Подключение к Streaming Fetch API
  - Чтение ReadableStream
  - Обработка событий (task_started, task_progress, task_completed)
  - Автоматический reconnect
- **Особенности**:
  - Exponential backoff для reconnect
  - Heartbeat поддержка
  - Event-based архитектура

#### Schemas
- **Файл**: `src/api/schemas.ts`
- **Содержит**: Zod схемы для всех API типов
- **Типы**:
  - HealthResponse
  - ChatSessionResponse
  - MessageRequest/Response
  - StreamEvent
  - AgentResponse

### 2. Context Collector (`src/context/`)

- **Файл**: `src/context/collector.ts`
- **Класс**: `ContextCollector`
- **Собирает**:
  - Активный файл (путь, содержимое, язык)
  - Выделенный текст
  - Список файлов workspace (до 100)
  - Diagnostics (ошибки, предупреждения)
  - Document symbols
- **Оптимизация**:
  - Кэширование workspace файлов (TTL 1 минута)
  - Лимиты на размер (1MB файл, 10MB общий)
  - Incremental collection

### 3. Commands (`src/commands/`)

Реализованные команды:
1. **codelab.openChat** - Открыть чат
2. **codelab.explainSelection** - Объяснить выделенный код
3. **codelab.refactorSelection** - Предложить рефакторинг
4. **codelab.fixErrors** - Исправить ошибки
5. **codelab.generateCode** - Генерировать код
6. **codelab.setApiToken** - Установить API токен

Все команды:
- Доступны через Command Palette
- Интегрированы в контекстное меню
- Собирают необходимый контекст
- Открывают чат с результатом

### 4. Diff Engine (`src/diff/`)

- **Файл**: `src/diff/engine.ts`
- **Класс**: `DiffEngine`
- **Функции**:
  - Парсинг unified diff
  - Показ preview изменений
  - Применение через WorkspaceEdit
  - Поддержка multi-file changes
- **Безопасность**:
  - Обязательное подтверждение пользователя
  - Валидация diff перед применением
  - Поддержка undo
  - Атомарное применение

### 5. UI Layer (`src/ui/`)

- **Файл**: `src/ui/ChatViewProvider.ts`
- **Класс**: `ChatViewProvider`
- **Реализует**: `vscode.WebviewViewProvider`
- **Функции**:
  - Регистрация в Activity Bar
  - WebView с HTML/CSS/JS
  - Обработка сообщений от UI
  - Интеграция с API
- **UI Features**:
  - Список сообщений
  - Input с auto-resize
  - Кнопки действий
  - Индикатор загрузки
  - New Chat функция

### 6. Extension Entry Point (`src/extension.ts`)

- **Функция**: `activate()`
- **Инициализация**:
  - Создание CodeLabAPI
  - Регистрация ChatViewProvider
  - Регистрация команд
  - Проверка API токена
- **Функция**: `deactivate()`
- **Cleanup**: Отключение streaming, очистка кэшей

## Технологический стек

### Core
- **TypeScript 5.9+** - Strict mode, полная типизация
- **VS Code API 1.109+** - Последняя стабильная версия
- **Node.js 22.x** - LTS с современными возможностями

### Dependencies
- **zod ^3.23.8** - Runtime валидация с type inference

### Dev Dependencies
- **esbuild 0.27+** - Быстрый bundler
- **vitest 2.1+** - Современный test runner
- **eslint 9.x** - Линтинг с flat config
- **typescript-eslint 8.x** - TypeScript правила

## Конфигурация

### VS Code Settings

```json
{
  "codelab.api.baseUrl": "http://localhost:8000",
  "codelab.api.timeout": 30000,
  "codelab.api.retryAttempts": 3,
  "codelab.api.streamingEnabled": true,
  "codelab.context.maxFileSize": 1048576,
  "codelab.context.maxFiles": 100,
  "codelab.context.maxContextSize": 10485760
}
```

### TypeScript Config

- **Module**: Node16
- **Target**: ES2022
- **Strict mode**: Enabled
- **Source maps**: Enabled
- **Root dir**: src/

### Build Config

- **esbuild.js**: Bundling extension code
- **Format**: CommonJS (required by VS Code)
- **Minification**: Production only
- **Source maps**: Always

## Безопасность

### 1. Token Storage
- Использование `vscode.SecretStorage`
- Никогда не логируются
- Не хранятся в plaintext

### 2. WebView Security
- Content Security Policy (CSP)
- No eval()
- No inline scripts
- Nonce для scripts

### 3. Input Validation
- Zod валидация всех входных данных
- Санитизация путей файлов
- Проверка размеров контекста

## Производительность

### Оптимизации
1. **Lazy loading** - Компоненты загружаются по требованию
2. **Caching** - Workspace файлы кэшируются
3. **Debouncing** - Для частых операций
4. **Streaming** - Постепенный вывод ответов
5. **Incremental collection** - Контекст собирается инкрементально

### Метрики
- Extension activation: ≤ 100ms (цель)
- WebView load: ≤ 200ms (цель)
- Context collection: ≤ 500ms (цель)

## Тестирование

### Unit Tests
- **Framework**: Vitest
- **Location**: `src/**/__tests__/*.test.ts`
- **Coverage**: Цель ≥ 80%
- **Run**: `npm test`

### Manual Testing
1. Запустить Extension Development Host (F5)
2. Открыть CodeLab в Activity Bar
3. Установить API токен
4. Протестировать команды
5. Проверить streaming
6. Протестировать diff application

## Развертывание

### Packaging
```bash
npm run package
```

Создает оптимизированный bundle в `dist/`.

### Publishing
```bash
vsce package
vsce publish
```

Создает `.vsix` файл для публикации.

## Известные ограничения

1. **WebView UI** - Базовый HTML/CSS/JS (React UI - future enhancement)
2. **Streaming** - Требует поддержку на backend
3. **Diff parsing** - Поддержка только unified diff формата
4. **Context size** - Ограничен 10MB

## Будущие улучшения

### Phase 2
- React 18.3+ UI с Vite
- File attachments в чате
- Multi-file refactoring
- Code generation templates
- Custom agents configuration

### Phase 3
- Collaborative features
- Code review assistance
- Test generation
- Documentation generation
- Performance profiling

## Соответствие спецификациям

Реализация полностью соответствует:
- ✅ `openspec/specs/architecture.md`
- ✅ `openspec/specs/functional-requirements.md`
- ✅ `openspec/specs/ui-components.md`
- ✅ `openspec/specs/api-integration.md`

## Поддержка

Для вопросов и проблем используйте GitHub Issues.
