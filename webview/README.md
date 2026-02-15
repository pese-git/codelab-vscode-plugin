# CodeLab WebView UI

React-based UI для VS Code плагина CodeLab.

## Технологический стек

- **React 18.3+** - UI framework
- **TypeScript 5.9+** - типизация
- **Vite 5.x** - сборка
- **@vscode/webview-ui-toolkit** - нативные VS Code компоненты
- **marked** - рендеринг markdown
- **highlight.js** - подсветка синтаксиса
- **@tanstack/react-virtual** - виртуализация списков

## Структура проекта

```
webview/
├── src/
│   ├── App.tsx                 # Главный компонент
│   ├── main.tsx               # Точка входа
│   ├── vite-env.d.ts          # Типы для Vite
│   ├── components/            # React компоненты
│   │   ├── ChatHeader.tsx
│   │   ├── MessageList.tsx
│   │   ├── ChatInput.tsx
│   │   ├── CodeBlock.tsx
│   │   ├── ActionButtons.tsx
│   │   └── Message/
│   │       ├── UserMessage.tsx
│   │       ├── AssistantMessage.tsx
│   │       └── ProgressMessage.tsx
│   ├── hooks/                 # React хуки
│   │   ├── useVSCode.ts
│   │   └── useMessages.ts
│   ├── types/                 # TypeScript типы
│   │   └── index.ts
│   └── styles/                # Глобальные стили
│       └── global.css
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Разработка

### Установка зависимостей

```bash
npm install
```

### Режим разработки

```bash
npm run dev
```

Vite запустит dev server с hot reload на http://localhost:5173

### Сборка

```bash
npm run build
```

Собранные файлы будут в `../dist/webview/`

### Проверка типов

```bash
npm run type-check
```

## Компоненты

### ChatHeader
Заголовок чата с кнопками "New Chat" и "Settings"

### MessageList
Список сообщений с виртуализацией для производительности

### Message Components
- **UserMessage** - сообщения пользователя
- **AssistantMessage** - ответы ассистента с markdown
- **ProgressMessage** - индикатор прогресса

### ChatInput
Поле ввода с поддержкой:
- Enter для отправки
- Shift+Enter для новой строки
- Автоматическое изменение высоты

### CodeBlock
Блок кода с:
- Подсветкой синтаксиса (highlight.js)
- Кнопкой копирования
- Поддержкой множества языков

### ActionButtons
Кнопки действий для сообщений:
- Apply Changes - применить изменения
- Retry - повторить запрос

## Взаимодействие с Extension

### Сообщения от WebView к Extension

```typescript
// Готовность WebView
{ type: 'ready' }

// Отправка сообщения
{ type: 'sendMessage', content: string }

// Применение изменений
{ type: 'applyChanges', messageId: string }

// Копирование кода
{ type: 'copyCode', code: string }

// Новый чат
{ type: 'newChat' }

// Повтор сообщения
{ type: 'retryMessage', messageId: string }
```

### Сообщения от Extension к WebView

```typescript
// Начальное состояние
{ 
  type: 'initialState', 
  payload: { 
    sessionId: string | null, 
    messages: Message[] 
  } 
}

// Задача начата
{ 
  type: 'taskStarted', 
  payload: { task_id: string } 
}

// Прогресс задачи
{ 
  type: 'taskProgress', 
  payload: { 
    task_id: string, 
    progress_percent: number, 
    message: string 
  } 
}

// Задача завершена
{ 
  type: 'taskCompleted', 
  payload: { 
    task_id: string, 
    result: string, 
    timestamp: string, 
    agent_id?: string 
  } 
}

// Код скопирован
{ type: 'codeCopied' }
```

## Стилизация

Используются VS Code Design Tokens для автоматической поддержки всех тем:

```css
/* Цвета */
--vscode-foreground
--vscode-editor-background
--vscode-button-background
--vscode-input-background
/* и т.д. */

/* Шрифты */
--vscode-font-family
--vscode-editor-font-family
```

CSS Modules для компонентов с автоматической генерацией уникальных имен классов.

## Производительность

- **Virtual Scrolling** - рендеринг только видимых сообщений
- **React.memo** - мемоизация компонентов
- **useMemo/useCallback** - оптимизация хуков
- **Code Splitting** - разделение на chunks (react-vendor, markdown)

## Безопасность

- **Content Security Policy** - строгий CSP в HTML
- **Marked** - безопасный рендеринг markdown
- **Input Validation** - валидация пользовательского ввода
- **No eval()** - отсутствие небезопасных конструкций
