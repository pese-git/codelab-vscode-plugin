# CodeLab VS Code Plugin - Testing Guide

## Запуск плагина в режиме разработки

### 1. Подготовка

```bash
# Установить зависимости
npm install

# Скомпилировать код
npm run compile
```

### 2. Запуск Extension Development Host

1. Открыть проект в VS Code
2. Нажать `F5` или выбрать `Run > Start Debugging`
3. Откроется новое окно VS Code с установленным плагином

### 3. Первоначальная настройка

1. В новом окне откройте Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Выполните команду: `CodeLab: Set API Token`
3. Введите ваш API токен
4. Настройте backend URL в Settings (если отличается от `http://localhost:8000`)

## Тестирование функций

### 1. Тестирование Chat Interface

1. Кликните на иконку CodeLab в Activity Bar (слева)
2. Откроется Sidebar с чатом
3. Введите сообщение в поле ввода
4. Нажмите `Send` или `Enter`
5. Проверьте:
   - ✅ Сообщение отображается в списке
   - ✅ Показывается индикатор загрузки
   - ✅ Приходит ответ от AI
   - ✅ Ответ корректно отформатирован

### 2. Тестирование Explain Selection

1. Откройте любой файл с кодом
2. Выделите фрагмент кода
3. Правый клик → `CodeLab: Explain Selection`
4. Проверьте:
   - ✅ Чат открывается автоматически
   - ✅ Запрос содержит выделенный код
   - ✅ Получен ответ с объяснением

### 3. Тестирование Refactor Selection

1. Откройте файл с кодом
2. Выделите код для рефакторинга
3. Правый клик → `CodeLab: Refactor Selection`
4. Проверьте:
   - ✅ Получены предложения по рефакторингу
   - ✅ Если есть diff, показывается кнопка Apply

### 4. Тестирование Fix Errors

1. Откройте файл с ошибками (или создайте их)
2. Command Palette → `CodeLab: Fix Errors`
3. Проверьте:
   - ✅ Если нет ошибок, показывается уведомление
   - ✅ Если есть ошибки, они отправляются в AI
   - ✅ Получены предложения по исправлению

### 5. Тестирование Generate Code

1. Command Palette → `CodeLab: Generate Code`
2. Введите описание кода
3. Проверьте:
   - ✅ Код генерируется согласно описанию
   - ✅ Можно скопировать или вставить код

### 6. Тестирование Diff Application

1. Получите ответ с изменениями кода (diff)
2. Нажмите кнопку `Apply Changes`
3. Проверьте:
   - ✅ Показывается preview изменений
   - ✅ Запрашивается подтверждение
   - ✅ После подтверждения изменения применяются
   - ✅ Можно отменить через Undo (`Ctrl+Z`)

### 7. Тестирование Streaming

1. Отправьте сообщение в чат
2. Проверьте:
   - ✅ Ответ выводится постепенно (streaming)
   - ✅ Показывается прогресс
   - ✅ При разрыве соединения происходит reconnect

### 8. Тестирование New Chat

1. В чате нажмите кнопку `New Chat`
2. Проверьте:
   - ✅ История очищается
   - ✅ Создается новая сессия
   - ✅ Можно начать новый диалог

## Unit Tests

### Запуск тестов

```bash
# Запустить все тесты
npm test

# Запустить в watch mode
npm run test:watch

# С coverage
npm test -- --coverage
```

### Структура тестов

```
src/
└── api/
    └── __tests__/
        └── client.test.ts
```

### Добавление новых тестов

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('MyComponent', () => {
  beforeEach(() => {
    // Setup
  });
  
  it('should do something', () => {
    // Test
    expect(result).toBe(expected);
  });
});
```

## Проверка производительности

### Extension Activation Time

1. Откройте Extension Development Host
2. Откройте Developer Tools (`Help > Toggle Developer Tools`)
3. В Console выполните:
```javascript
performance.getEntriesByType('measure')
```
4. Найдите время активации extension
5. Цель: ≤ 100ms

### WebView Load Time

1. Откройте CodeLab sidebar
2. В Developer Tools проверьте Network tab
3. Время загрузки WebView
4. Цель: ≤ 200ms

### Context Collection Time

1. Добавьте логирование в `ContextCollector.collectContext()`
2. Отправьте сообщение
3. Проверьте время сбора контекста
4. Цель: ≤ 500ms

## Проверка безопасности

### 1. Token Storage

```bash
# Проверить, что токен не в plaintext
grep -r "apiToken" ~/.config/Code/User/
# Не должно найти токен
```

### 2. WebView CSP

1. Откройте Developer Tools для WebView
2. Проверьте Console на CSP ошибки
3. Не должно быть нарушений CSP

### 3. Input Validation

1. Попробуйте отправить невалидные данные
2. Проверьте, что Zod валидация работает
3. Ошибки должны обрабатываться gracefully

## Тестирование ошибок

### 1. Network Errors

1. Остановите backend
2. Попробуйте отправить сообщение
3. Проверьте:
   - ✅ Показывается ошибка
   - ✅ Происходит retry
   - ✅ После нескольких попыток показывается финальная ошибка

### 2. Invalid Token

1. Установите невалидный токен
2. Попробуйте отправить сообщение
3. Проверьте:
   - ✅ Получена ошибка 401
   - ✅ Предложено установить новый токен

### 3. Streaming Disconnect

1. Во время streaming отключите сеть
2. Проверьте:
   - ✅ Происходит автоматический reconnect
   - ✅ Exponential backoff работает
   - ✅ После max попыток показывается ошибка

## Checklist перед релизом

### Функциональность
- [ ] Все команды работают
- [ ] Chat interface функционален
- [ ] Streaming работает корректно
- [ ] Diff application безопасен
- [ ] Context collection работает
- [ ] Error handling корректен

### Производительность
- [ ] Extension activation ≤ 100ms
- [ ] WebView load ≤ 200ms
- [ ] Context collection ≤ 500ms
- [ ] Memory usage приемлемый

### Безопасность
- [ ] Токены в SecretStorage
- [ ] CSP настроен правильно
- [ ] Input validation работает
- [ ] Нет XSS уязвимостей

### Качество кода
- [ ] TypeScript компилируется без ошибок
- [ ] ESLint проходит
- [ ] Unit tests проходят
- [ ] Coverage ≥ 80%

### Документация
- [ ] README.md актуален
- [ ] CHANGELOG.md обновлен
- [ ] Комментарии в коде
- [ ] API документирован

## Отладка

### Логирование

```typescript
// В extension.ts
console.log('Debug info:', data);

// В WebView
console.log('WebView debug:', data);
```

### Breakpoints

1. Установите breakpoint в VS Code
2. Запустите Extension Development Host (F5)
3. Debugger остановится на breakpoint

### VS Code Developer Tools

1. `Help > Toggle Developer Tools` - для extension host
2. В WebView правый клик → `Inspect` - для WebView

## Известные проблемы

### 1. TypeScript errors для fetch/AbortController
- **Причина**: Node.js типы не включают fetch API
- **Решение**: Используется skipLibCheck в tsconfig.json
- **Статус**: Работает корректно в runtime

### 2. ESLint warning в errors.ts
- **Предупреждение**: no-throw-literal
- **Причина**: Throw lastError!
- **Статус**: Безопасно, lastError всегда Error

## Поддержка

При обнаружении проблем:
1. Проверьте логи в Developer Tools
2. Проверьте настройки плагина
3. Убедитесь, что backend доступен
4. Создайте issue на GitHub с деталями
