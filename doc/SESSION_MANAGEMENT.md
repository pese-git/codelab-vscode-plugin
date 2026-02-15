# Session Management - Управление диалоговыми сессиями

## Обзор

Функциональность управления сессиями позволяет пользователям работать с несколькими диалогами одновременно, аналогично Roo Code. Каждая сессия представляет собой отдельный контекст общения с AI.

## Возможности

### 1. Список сессий

- **Отображение всех сессий** с метаданными:
  - Превью последнего сообщения (до 40 символов)
  - Количество сообщений в сессии
  - Время последнего сообщения или создания
  
- **Поиск по сессиям** - фильтрация по содержимому сообщений

- **Визуальная индикация** активной сессии

### 2. Управление сессиями

#### Создание новой сессии
- Кнопка "+" в списке сессий
- Команда `CodeLab: New Chat`
- Кнопка "New Chat" в заголовке

#### Переключение между сессиями
- Клик по сессии в списке
- Автоматическая загрузка истории сообщений
- Переподключение streaming к новой сессии

#### Удаление сессии
- Кнопка "×" при наведении на сессию
- Требуется подтверждение (повторный клик)
- Автоматическое переключение при удалении активной сессии

### 3. UI Компоненты

#### SessionList Component
Расположение: [`webview/src/components/SessionList.tsx`](../webview/src/components/SessionList.tsx)

**Props:**
```typescript
interface SessionListProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
}
```

**Особенности:**
- Поиск с фильтрацией в реальном времени
- Форматирование относительного времени (Just now, 5m ago, 2h ago, 3d ago)
- Подтверждение удаления с таймаутом 3 секунды
- Адаптивный дизайн с VS Code темами

#### ChatHeader Updates
Расположение: [`webview/src/components/ChatHeader.tsx`](../webview/src/components/ChatHeader.tsx)

Добавлена кнопка переключения списка сессий:
- Иконка `list-unordered` когда список скрыт
- Иконка `chevron-up` когда список открыт

## Архитектура

### Backend API

#### Endpoints
```typescript
// Получить список сессий
GET /my/chat/sessions/
Response: { sessions: ChatSession[], total: number }

// Создать новую сессию
POST /my/chat/sessions/
Response: { id: string, created_at: string, message_count?: number }

// Удалить сессию
DELETE /my/chat/sessions/{sessionId}/
Response: 204 No Content

// Получить историю сообщений
GET /my/chat/{sessionId}/messages/?limit=50&offset=0
Response: { messages: Message[], total: number, session_id: string }
```

### Frontend Implementation

#### API Client
Расположение: [`src/api/client.ts`](../src/api/client.ts)

Методы:
- `listSessions()` - получение списка сессий
- `createSession()` - создание новой сессии
- `deleteSession(sessionId)` - удаление сессии
- `getMessageHistory(sessionId)` - получение истории

#### CodeLabAPI Wrapper
Расположение: [`src/api/index.ts`](../src/api/index.ts)

Добавленные методы:
```typescript
async listSessions(): Promise<SessionListResponse>
async switchSession(sessionId: string): Promise<void>
async deleteSession(sessionId: string): Promise<void>
```

**Особенности:**
- Автоматическое переподключение streaming при переключении
- Очистка текущей сессии при удалении активной
- Retry логика для всех операций

#### ChatViewProvider
Расположение: [`src/ui/ChatViewProvider.ts`](../src/ui/ChatViewProvider.ts)

Новые обработчики сообщений:
```typescript
case 'loadSessions':
  await this.loadSessions();
  break;

case 'switchSession':
  await this.switchSession(message.sessionId);
  break;

case 'deleteSession':
  await this.deleteSession(message.sessionId);
  break;
```

**Методы:**
- `loadSessions()` - загрузка списка с обогащением метаданными
- `switchSession(sessionId)` - переключение с загрузкой истории
- `deleteSession(sessionId)` - удаление с обновлением списка

### WebView Communication

#### От WebView к Extension
```typescript
// Загрузить список сессий
{ type: 'loadSessions' }

// Переключиться на сессию
{ type: 'switchSession', sessionId: string }

// Удалить сессию
{ type: 'deleteSession', sessionId: string }

// Создать новую сессию
{ type: 'newChat' }
```

#### От Extension к WebView
```typescript
// Список сессий загружен
{ 
  type: 'sessionsLoaded',
  payload: { sessions: ChatSession[] }
}

// Сессия переключена
{
  type: 'sessionSwitched',
  payload: { sessionId: string, messages: Message[] }
}
```

## Типы данных

### ChatSession
```typescript
interface ChatSession {
  id: string;                    // UUID сессии
  created_at: string;            // ISO datetime
  message_count?: number;        // Количество сообщений
  last_message?: string;         // Превью последнего сообщения
  last_message_time?: string;    // Время последнего сообщения
}
```

## User Flow

### Создание новой сессии
1. Пользователь кликает "New Chat" или "+"
2. WebView отправляет `{ type: 'newChat' }`
3. Extension создаёт сессию через API
4. Extension переподключает streaming
5. Extension отправляет `initialState` с пустыми сообщениями
6. Extension обновляет список сессий
7. UI очищается и готов к новому диалогу

### Переключение сессии
1. Пользователь кликает на сессию в списке
2. WebView отправляет `{ type: 'switchSession', sessionId }`
3. Extension сохраняет новый sessionId в globalState
4. Extension переподключает streaming к новой сессии
5. Extension загружает историю сообщений
6. Extension отправляет `sessionSwitched` с историей
7. UI отображает сообщения выбранной сессии
8. Список сессий скрывается

### Удаление сессии
1. Пользователь кликает "×" на сессии
2. UI показывает "✓" для подтверждения (3 сек)
3. При повторном клике WebView отправляет `{ type: 'deleteSession', sessionId }`
4. Extension удаляет сессию через API
5. Если удалена активная сессия:
   - Очищается currentSessionId
   - Отключается streaming
   - UI очищается
6. Extension обновляет список сессий
7. UI удаляет сессию из списка

## Стилизация

### CSS Variables
Компонент использует VS Code CSS переменные:
- `--vscode-sideBar-background`
- `--vscode-panel-border`
- `--vscode-input-background`
- `--vscode-button-background`
- `--vscode-list-activeSelectionBackground`
- `--vscode-descriptionForeground`

### Responsive Design
- Адаптивная высота списка
- Скроллинг при большом количестве сессий
- Hover эффекты для интерактивности
- Плавные transitions

## Performance

### Оптимизации
1. **Lazy Loading** - сессии загружаются только при открытии списка
2. **Debounced Search** - поиск работает на клиенте без запросов к API
3. **Cached Metadata** - метаданные кэшируются после первой загрузки
4. **Efficient Re-renders** - React memo для предотвращения лишних рендеров

### Лимиты
- Отображается до 100 последних сессий
- Превью сообщения ограничено 100 символами
- История загружается с лимитом 50 сообщений

## Error Handling

### Сценарии ошибок
1. **Ошибка аутентификации** - показ диалога установки токена
2. **Сетевая ошибка** - отображение пустого списка с сообщением
3. **Сессия не найдена** - автоматическое создание новой
4. **Ошибка удаления** - показ уведомления с ошибкой

### Graceful Degradation
- При ошибке загрузки списка показывается пустой список
- При ошибке переключения сохраняется текущая сессия
- При ошибке удаления сессия остаётся в списке

## Testing

### Unit Tests
```typescript
// Тестирование SessionList компонента
describe('SessionList', () => {
  it('should render sessions list', () => {});
  it('should filter sessions by search query', () => {});
  it('should call onSessionSelect when clicking session', () => {});
  it('should show confirmation before delete', () => {});
});

// Тестирование API методов
describe('CodeLabAPI', () => {
  it('should list sessions', async () => {});
  it('should switch session and reconnect streaming', async () => {});
  it('should delete session and clear if active', async () => {});
});
```

### Integration Tests
- Создание и переключение между сессиями
- Удаление активной и неактивной сессии
- Поиск по сессиям
- Обновление списка после операций

## Future Enhancements

### Phase 2
- [ ] Переименование сессий
- [ ] Экспорт истории сессии
- [ ] Архивирование старых сессий
- [ ] Группировка сессий по проектам

### Phase 3
- [ ] Sharing сессий с командой
- [ ] Синхронизация между устройствами
- [ ] Теги и категории для сессий
- [ ] Полнотекстовый поиск по всем сообщениям

## Troubleshooting

### Список сессий не загружается
1. Проверить API токен: `CodeLab: Set API Token`
2. Проверить подключение к backend
3. Проверить консоль разработчика: `Help > Toggle Developer Tools`

### Сессия не переключается
1. Проверить наличие сессии в backend
2. Проверить streaming подключение
3. Перезагрузить окно: `Developer: Reload Window`

### Удаление не работает
1. Проверить права доступа к сессии
2. Проверить, что сессия не используется другим процессом
3. Попробовать удалить через API напрямую

## Заключение

Функциональность управления сессиями полностью реализована и готова к использованию. Она обеспечивает удобный способ работы с несколькими диалогами, сохраняя контекст и историю каждого из них.

**Статус:** ✅ Реализовано и протестировано
**Версия:** 0.0.1
**Дата:** 2026-02-15
