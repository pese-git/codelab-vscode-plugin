# Functional Requirements Specification

## Обзор

Спецификация функциональных требований VS Code плагина CodeLab на основе [`doc/technical-requirements.md`](../../doc/technical-requirements.md). Документ описывает все функции, команды и возможности плагина с использованием современного технологического стека.

## Основные цели

1. **Повысить продуктивность разработчиков** через AI-ассистента
2. **Обеспечить интерактивное взаимодействие** с кодом через React чат
3. **Поддерживать все языки программирования** через LSP
4. **Минимизировать логику в плагине** - вынести интеллект в backend
5. **Обеспечить type safety** - Zod валидация и TypeScript strict mode
6. **Гарантировать производительность** - виртуализация, мемоизация, code splitting

## Функциональные модули

### 1. Chat Interface

#### FR-1.1: Sidebar Chat View

**Описание:** Основной интерфейс взаимодействия с AI через чат в Sidebar.

**Требования:**
- Отображается в Activity Bar с иконкой CodeLab
- WebView с React-приложением
- Поддержка markdown rendering
- Syntax highlighting для code blocks
- Streaming ответов (постепенный вывод)

**Acceptance Criteria:**
- [ ] Sidebar открывается при клике на иконку в Activity Bar
- [ ] Сообщения отображаются в хронологическом порядке
- [ ] Markdown корректно рендерится
- [ ] Code blocks подсвечиваются синтаксически
- [ ] Streaming работает плавно без задержек

#### FR-1.2: Message Input

**Описание:** Поле ввода для отправки сообщений AI.

**Требования:**
- Textarea с auto-resize (до 120px высоты)
- Enter для отправки, Shift+Enter для новой строки
- Кнопка отправки (disabled когда пусто)
- Кнопка прикрепления файлов (будущая функция)

**Acceptance Criteria:**
- [ ] Textarea растет при вводе текста
- [ ] Enter отправляет сообщение
- [ ] Shift+Enter добавляет новую строку
- [ ] Кнопка Send активна только при наличии текста

#### FR-1.3: Message Actions

**Описание:** Действия над сообщениями от AI.

**Требования:**
- **Copy** - копирование code blocks
- **Apply Changes** - применение diff к файлам
- **Retry** - повторная отправка запроса

**Acceptance Criteria:**
- [ ] Copy копирует код в clipboard
- [ ] Apply Changes показывает preview перед применением
- [ ] Retry отправляет тот же запрос заново

#### FR-1.4: Chat History

**Описание:** Сохранение и отображение истории чата.

**Требования:**
- История сохраняется в backend (chat sessions)
- Загрузка истории при открытии плагина
- Возможность создать новый чат
- Pagination для длинных историй

**Acceptance Criteria:**
- [ ] История загружается при старте
- [ ] Новый чат очищает текущую историю
- [ ] Старые сообщения подгружаются при скролле вверх

#### FR-1.5: Session Management

**Описание:** Управление диалоговыми сессиями аналогично Roo Code.

**Требования:**
- Отображение списка всех диалоговых сессий
- Возможность переключения между сессиями
- Загрузка истории сообщений при переходе в сессию
- Создание новой сессии (новый диалог)
- Отображение метаданных сессии (дата создания, последнее сообщение)
- Поиск по сессиям
- Удаление сессий

**UI Components:**
- Список сессий в Sidebar (над чатом или в отдельной вкладке)
- Кнопка "New Chat" для создания новой сессии
- Индикатор активной сессии
- Preview последнего сообщения в списке
- Timestamp для каждой сессии

**Acceptance Criteria:**
- [ ] Список сессий отображается в UI
- [ ] Клик по сессии загружает её историю в чат
- [ ] Кнопка "New Chat" создаёт новую пустую сессию
- [ ] Активная сессия визуально выделена
- [ ] Метаданные сессий корректно отображаются
- [ ] Поиск по сессиям работает
- [ ] Удаление сессии требует подтверждения
- [ ] Переключение между сессиями происходит мгновенно

### 2. Context Collection

#### FR-2.1: Active File Context

**Описание:** Автоматический сбор контекста активного файла.

**Требования:**
- Путь к файлу (относительный)
- Содержимое файла
- Language ID
- Выделенный текст (если есть)
- Позиция курсора

**Acceptance Criteria:**
- [ ] Контекст собирается при отправке сообщения
- [ ] Выделенный текст включается в контекст
- [ ] Language ID определяется корректно

#### FR-2.2: Workspace Context

**Описание:** Сбор информации о workspace.

**Требования:**
- Список файлов проекта (с лимитом 100)
- Исключение node_modules, .git и других
- Структура директорий

**Acceptance Criteria:**
- [ ] Собирается список до 100 файлов
- [ ] node_modules исключается
- [ ] Относительные пути используются

#### FR-2.3: Diagnostics Context

**Описание:** Сбор ошибок и предупреждений из LSP.

**Требования:**
- Все diagnostics из активного файла
- Severity (error, warning, info)
- Сообщение и позиция
- Передача в backend для анализа

**Acceptance Criteria:**
- [ ] Diagnostics собираются из LSP
- [ ] Включаются в контекст при команде "Fix Errors"
- [ ] Правильно маппится severity

#### FR-2.4: Symbols Context

**Описание:** Сбор symbols из документа.

**Требования:**
- Document symbols через LSP
- Имена функций, классов, переменных
- Locations в файле

**Acceptance Criteria:**
- [ ] Symbols извлекаются через LSP
- [ ] Включаются имена и типы
- [ ] Locations корректны

### 3. VS Code Commands

#### FR-3.1: Open Chat

**Команда:** `codelab.openChat`

**Описание:** Открывает Sidebar с чатом.

**Trigger:**
- Command Palette: "CodeLab: Open Chat"
- Keybinding: настраиваемый

**Acceptance Criteria:**
- [ ] Команда доступна в Command Palette
- [ ] Sidebar открывается при вызове
- [ ] Focus переходит на input

#### FR-3.2: Explain Selection

**Команда:** `codelab.explainSelection`

**Описание:** Объясняет выделенный код.

**Trigger:**
- Command Palette: "CodeLab: Explain Selection"
- Context Menu: правый клик на выделенном коде
- Keybinding: настраиваемый

**Behavior:**
1. Проверить наличие выделения
2. Собрать контекст (файл + выделение)
3. Отправить в backend с промптом "Explain this code"
4. Открыть чат и показать ответ

**Acceptance Criteria:**
- [ ] Работает только при наличии выделения
- [ ] Контекст включает выделенный код
- [ ] Ответ отображается в чате

#### FR-3.3: Refactor Selection

**Команда:** `codelab.refactorSelection`

**Описание:** Предлагает рефакторинг выделенного кода.

**Trigger:**
- Command Palette: "CodeLab: Refactor Selection"
- Context Menu
- Keybinding

**Behavior:**
1. Проверить наличие выделения
2. Собрать контекст
3. Отправить с промптом "Suggest refactoring for this code"
4. Показать diff в чате
5. Предложить Apply Changes

**Acceptance Criteria:**
- [ ] Работает только при наличии выделения
- [ ] Возвращает diff
- [ ] Apply Changes применяет рефакторинг

#### FR-3.4: Fix Errors

**Команда:** `codelab.fixErrors`

**Описание:** Исправляет ошибки в активном файле.

**Trigger:**
- Command Palette: "CodeLab: Fix Errors"
- Context Menu
- Keybinding

**Behavior:**
1. Собрать diagnostics из активного файла
2. Если нет ошибок - показать уведомление
3. Отправить в backend с diagnostics
4. Показать предложенные исправления
5. Предложить Apply Changes

**Acceptance Criteria:**
- [ ] Собирает все diagnostics
- [ ] Показывает уведомление если нет ошибок
- [ ] Возвращает исправления в виде diff

#### FR-3.5: Generate Code

**Команда:** `codelab.generateCode`

**Описание:** Генерирует код по описанию.

**Trigger:**
- Command Palette: "CodeLab: Generate Code"
- Keybinding

**Behavior:**
1. Открыть input для описания
2. Собрать контекст проекта
3. Отправить в backend
4. Показать сгенерированный код
5. Предложить вставить в файл

**Acceptance Criteria:**
- [ ] Запрашивает описание у пользователя
- [ ] Генерирует код на основе контекста
- [ ] Предлагает вставку в активный файл

#### FR-3.6: New Chat Session

**Команда:** `codelab.newChatSession`

**Описание:** Создаёт новую диалоговую сессию.

**Trigger:**
- Command Palette: "CodeLab: New Chat"
- UI Button: "New Chat" в списке сессий
- Keybinding: настраиваемый

**Behavior:**
1. Создать новую сессию через API
2. Очистить текущий чат
3. Переключиться на новую сессию
4. Установить focus на input

**Acceptance Criteria:**
- [ ] Новая сессия создаётся в backend
- [ ] UI переключается на пустой чат
- [ ] Новая сессия появляется в списке
- [ ] Focus устанавливается на input

#### FR-3.7: Switch Chat Session

**Команда:** `codelab.switchChatSession`

**Описание:** Переключается на выбранную диалоговую сессию.

**Trigger:**
- UI: клик по сессии в списке
- Command Palette: "CodeLab: Switch Chat Session" (с выбором)

**Behavior:**
1. Загрузить историю сообщений выбранной сессии
2. Отобразить сообщения в чате
3. Обновить UI (выделить активную сессию)
4. Сохранить ID активной сессии

**Acceptance Criteria:**
- [ ] История загружается корректно
- [ ] Сообщения отображаются в правильном порядке
- [ ] Активная сессия визуально выделена
- [ ] Переключение происходит без задержек

#### FR-3.8: Delete Chat Session

**Команда:** `codelab.deleteChatSession`

**Описание:** Удаляет диалоговую сессию.

**Trigger:**
- UI: кнопка удаления в списке сессий
- Command Palette: "CodeLab: Delete Chat Session"

**Behavior:**
1. Показать диалог подтверждения
2. При подтверждении удалить сессию через API
3. Удалить из списка в UI
4. Если удалена активная сессия - создать новую или переключиться на последнюю

**Acceptance Criteria:**
- [ ] Требуется подтверждение пользователя
- [ ] Сессия удаляется из backend
- [ ] UI обновляется корректно
- [ ] При удалении активной сессии происходит переключение

### 4. Diff & Apply Engine

#### FR-4.1: Diff Preview

**Описание:** Показ preview изменений перед применением.

**Требования:**
- Парсинг unified diff от backend
- Отображение в VS Code Diff Editor
- Подсветка добавленных/удаленных строк

**Acceptance Criteria:**
- [ ] Unified diff корректно парсится
- [ ] Diff Editor открывается с preview
- [ ] Изменения четко видны

#### FR-4.2: Apply Changes

**Описание:** Применение изменений к файлам.

**Требования:**
- Использование WorkspaceEdit API
- Подтверждение пользователя обязательно
- Поддержка undo
- Валидация diff перед применением

**Acceptance Criteria:**
- [ ] Изменения применяются через WorkspaceEdit
- [ ] Требуется подтверждение пользователя
- [ ] Undo работает корректно
- [ ] Невалидный diff отклоняется

#### FR-4.3: Multi-file Changes

**Описание:** Применение изменений к нескольким файлам.

**Требования:**
- Поддержка diff для нескольких файлов
- Атомарное применение (все или ничего)
- Показ списка затронутых файлов

**Acceptance Criteria:**
- [ ] Поддерживается multi-file diff
- [ ] Все изменения применяются атомарно
- [ ] Список файлов показывается перед применением

### 5. Streaming & Real-time Updates

#### FR-5.1: Streaming Responses

**Описание:** Постепенный вывод ответов от AI через Streaming Fetch API.

**Технологии:**
- Fetch API с ReadableStream
- TextDecoder для декодирования chunks
- AbortController для управления
- Exponential backoff для reconnect

**Требования:**
- Подключение к Streaming Fetch API endpoint
- Чтение ReadableStream с обработкой chunks
- Отображение токенов по мере получения
- Индикатор загрузки с прогрессом
- Graceful handling разрывов соединения
- Zod валидация stream events

**Acceptance Criteria:**
- [ ] Ответы выводятся постепенно через ReadableStream
- [ ] Индикатор показывается во время обработки
- [ ] Reconnect работает автоматически с exponential backoff
- [ ] Stream events валидируются через Zod
- [ ] AbortController корректно отменяет запросы

#### FR-5.2: Progress Updates

**Описание:** Отображение прогресса выполнения задач.

**Требования:**
- Progress bar для долгих операций
- Текстовое описание текущего шага
- Процент выполнения

**Acceptance Criteria:**
- [ ] Progress bar обновляется в real-time
- [ ] Текст описывает текущий шаг
- [ ] Процент корректно отображается

#### FR-5.3: Agent Status

**Описание:** Отображение статуса агентов и выбор агента для общения.

**Требования:**
- Индикация когда агент работает
- Имя агента в сообщениях
- Статус (ready, busy, error)
- Селектор агентов под полем ввода
- Режим "Auto" для автоматического выбора агента
- Иконки агентов по типу/имени
- Описание агентов из конфигурации

**Acceptance Criteria:**
- [x] Статус агента виден в UI
- [x] Имя агента показывается в сообщениях
- [ ] Busy индикатор отображается
- [x] Селектор агентов реализован под полем ввода
- [x] Режим "Auto" работает (null targetAgent)
- [x] Иконки определяются автоматически
- [x] Описания извлекаются из system_prompt
- [x] Выбранный агент передается в API при отправке сообщения

### 6. LSP Integration

#### FR-6.1: Diagnostics Collection

**Описание:** Получение diagnostics через LSP.

**Требования:**
- Подключение к LSP серверам
- Получение errors, warnings, info
- Фильтрация по активному файлу

**Acceptance Criteria:**
- [ ] LSP client подключается
- [ ] Diagnostics получаются корректно
- [ ] Фильтрация работает

#### FR-6.2: Symbols Extraction

**Описание:** Извлечение symbols через LSP.

**Требования:**
- Document symbols
- Workspace symbols (опционально)
- Semantic tokens

**Acceptance Criteria:**
- [ ] Document symbols извлекаются
- [ ] Типы symbols корректны
- [ ] Locations точны

#### FR-6.3: Hover Information

**Описание:** Получение hover info для контекста.

**Требования:**
- Hover information через LSP
- Type information
- Documentation

**Acceptance Criteria:**
- [ ] Hover info получается
- [ ] Включается в контекст при необходимости

### 7. Configuration & Settings

#### FR-7.1: API Configuration

**Описание:** Настройка подключения к backend.

**Settings:**
```json
{
  "codelab.api.baseUrl": "http://localhost:8000",
  "codelab.api.timeout": 30000,
  "codelab.api.retryAttempts": 3,
  "codelab.api.enableStreaming": true
}
```

**Acceptance Criteria:**
- [ ] Settings доступны в VS Code Settings
- [ ] Изменения применяются без перезапуска
- [ ] Валидация значений

#### FR-7.2: Authentication

**Описание:** Настройка аутентификации.

**Requirements:**
- JWT токен в SecretStorage
- Команда для ввода токена
- Автоматический refresh при истечении

**Acceptance Criteria:**
- [ ] Токен хранится в SecretStorage
- [ ] Команда для ввода токена работает
- [ ] Refresh токена автоматический

#### FR-7.3: Context Limits

**Описание:** Настройка лимитов контекста.

**Settings:**
```json
{
  "codelab.context.maxFileSize": 1048576,
  "codelab.context.maxFiles": 100,
  "codelab.context.maxContextSize": 10485760
}
```

**Acceptance Criteria:**
- [ ] Лимиты соблюдаются
- [ ] Предупреждение при превышении
- [ ] Настраиваемые значения

### 8. Error Handling & Notifications

#### FR-8.1: Network Errors

**Описание:** Обработка сетевых ошибок.

**Requirements:**
- Retry с exponential backoff
- Offline индикатор
- Fallback на REST при SSE недоступности

**Acceptance Criteria:**
- [ ] Retry работает автоматически
- [ ] Offline статус показывается
- [ ] Fallback активируется

#### FR-8.2: API Errors

**Описание:** Обработка ошибок от API.

**Requirements:**
- 401 - запрос нового токена
- 404 - уведомление пользователя
- 429 - rate limit handling
- 500 - показ ошибки

**Acceptance Criteria:**
- [ ] Каждый код обрабатывается правильно
- [ ] Пользователь информируется
- [ ] Retry где применимо

#### FR-8.3: User Notifications

**Описание:** Уведомления пользователя.

**Requirements:**
- Information messages
- Warning messages
- Error messages
- Progress notifications

**Acceptance Criteria:**
- [ ] Уведомления показываются в нужное время
- [ ] Правильный уровень severity
- [ ] Не спамят пользователя

### 9. Performance Requirements

#### FR-9.1: Startup Performance

**Requirement:** Extension activation ≤ 100ms

**Measures:**
- Lazy loading компонентов
- Отложенная инициализация LSP
- Минимальная работа при активации

**Acceptance Criteria:**
- [ ] Activation time ≤ 100ms
- [ ] Не блокирует VS Code UI

#### FR-9.2: WebView Performance

**Requirement:** WebView load ≤ 200ms

**Measures:**
- Минимальный bundle size
- Code splitting
- Lazy loading компонентов

**Acceptance Criteria:**
- [ ] Load time ≤ 200ms
- [ ] Smooth scrolling
- [ ] No UI freezes

#### FR-9.3: Context Collection Performance

**Requirement:** Context collection ≤ 500ms

**Measures:**
- Лимиты на размер
- Incremental collection
- Кэширование

**Acceptance Criteria:**
- [ ] Collection time ≤ 500ms
- [ ] Не блокирует UI
- [ ] Лимиты соблюдаются

### 10. Security Requirements

#### FR-10.1: Token Security

**Requirements:**
- Токены только в SecretStorage
- Никогда не логировать токены
- Не передавать в plaintext (только HTTPS в production)

**Acceptance Criteria:**
- [ ] Токены в SecretStorage
- [ ] Нет токенов в логах
- [ ] HTTPS для production

#### FR-10.2: WebView Security

**Requirements:**
- Content Security Policy
- No eval()
- No inline scripts
- Sandbox mode

**Acceptance Criteria:**
- [ ] CSP настроен правильно
- [ ] Нет eval() в коде
- [ ] Все scripts с nonce
- [ ] Sandbox активен

#### FR-10.3: Input Validation

**Requirements:**
- Валидация всех входных данных
- Санитизация путей файлов
- Проверка размеров

**Acceptance Criteria:**
- [ ] Все inputs валидируются
- [ ] Пути санитизируются
- [ ] Размеры проверяются

## Non-Functional Requirements

### NFR-1: Reliability

- Graceful error handling
- Automatic reconnection
- Data persistence
- No data loss

### NFR-2: Usability

- Intuitive UI
- Clear error messages
- Helpful tooltips
- Keyboard shortcuts

### NFR-3: Maintainability

- Clean code architecture
- Comprehensive tests
- Good documentation
- Type safety (TypeScript)

### NFR-4: Compatibility

- VS Code version: ≥ 1.109.0
- All platforms: Windows, macOS, Linux
- All languages через LSP

## Testing Requirements

### Unit Tests (Vitest)

**Технологии:**
- Vitest - быстрый test runner
- @testing-library/react - тестирование React компонентов
- Mock VS Code API

**Требования:**
- Coverage ≥ 80%
- All critical paths covered
- Mock external dependencies
- Typed mocks с TypeScript

**Примеры:**
```typescript
describe('APIClient', () => {
  it('should validate response with Zod', async () => {
    const response = await client.createSession();
    expect(ChatSessionResponseSchema.safeParse(response).success).toBe(true);
  });
});
```

### Integration Tests

**Требования:**
- API integration с mock backend
- WebView communication
- LSP integration
- Streaming Fetch API
- Diff application

### React Component Tests

**Технологии:**
- @testing-library/react
- @testing-library/user-event
- Vitest

**Требования:**
- User interaction testing
- Accessibility testing
- Snapshot testing для UI
- Performance testing

### E2E Tests

**Технологии:**
- @vscode/test-electron
- Extension Development Host

**Требования:**
- Complete user flows
- Command execution
- Chat interaction
- File modifications
- Streaming responses

## Acceptance Criteria (Overall)

Плагин считается готовым к релизу когда:

### Функциональность
- [ ] Все FR выполнены
- [ ] Все NFR соблюдены
- [ ] Запускается через F5 в Extension Development Host
- [ ] Sidebar Chat работает с React 18.3+ UI
- [ ] Streaming работает через Streaming Fetch API
- [ ] Diff применяется безопасно через WorkspaceEdit
- [ ] Нет AI-логики внутри extension

### Качество кода
- [ ] Test coverage ≥ 80% (Vitest)
- [ ] TypeScript strict mode enabled
- [ ] Все API responses валидируются через Zod
- [ ] ESLint проходит без ошибок
- [ ] Prettier форматирование применено

### Производительность
- [ ] Extension activation ≤ 100ms
- [ ] WebView load ≤ 200ms
- [ ] Context collection ≤ 500ms
- [ ] UI interaction ≤ 16ms (60 FPS)
- [ ] Memory usage ≤ 50MB idle, ≤ 200MB active

### Безопасность
- [ ] Security audit пройден
- [ ] CSP настроен для WebView
- [ ] Токены только в SecretStorage
- [ ] Input validation на всех границах через Zod
- [ ] No eval() в коде

### Документация
- [ ] README.md complete
- [ ] CHANGELOG.md актуален
- [ ] API documentation
- [ ] User guide
- [ ] Contributing guidelines

## Future Enhancements

### Phase 2 (Post-MVP)

- [ ] File attachments в чате
- [ ] Multi-file refactoring
- [ ] Code generation templates
- [ ] Custom agents configuration
- [ ] Workspace-wide search and replace

### Phase 3

- [ ] Collaborative features
- [ ] Code review assistance
- [ ] Test generation
- [ ] Documentation generation
- [ ] Performance profiling

### Phase 4

- [ ] Plugin marketplace integration
- [ ] Custom tool development
- [ ] Advanced memory management
- [ ] Multi-language support in UI
- [ ] Telemetry and analytics
