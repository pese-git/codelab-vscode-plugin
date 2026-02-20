import * as vscode from 'vscode';

export const messages = {
  en: {
    errors: {
      authRequired: 'API token not set or expired. Please set your CodeLab API token.',
      validationError: 'Validation error: {message}',
      networkError: 'Network error: {message}',
      apiError: 'API error ({status}): {message}',
      sessionNotFound: 'Session not found. It may have been deleted.',
      failedToSwitch: 'Failed to switch session: {message}',
      failedToDelete: 'Failed to delete session: {message}',
      connectionFailed: 'Failed to connect to CodeLab. Please check your connection.',
      agentsLoadFailed: 'Failed to load agents: data validation error. Some agents may not be displayed.',
      projectInitFailed: 'Failed to initialize project: {message}'
    },
    info: {
      connected: 'Connected to CodeLab',
      projectInitialized: 'CodeLab project initialized successfully',
      sessionCreated: 'New chat session created',
      sessionDeleted: 'Session deleted',
      codeCopied: 'Code copied to clipboard'
    }
  },
  ru: {
    errors: {
      authRequired: 'API токен не установлен или истек. Пожалуйста, установите токен CodeLab.',
      validationError: 'Ошибка валидации: {message}',
      networkError: 'Ошибка сети: {message}',
      apiError: 'Ошибка API ({status}): {message}',
      sessionNotFound: 'Сессия не найдена. Возможно, она была удалена.',
      failedToSwitch: 'Не удалось переключить сессию: {message}',
      failedToDelete: 'Не удалось удалить сессию: {message}',
      connectionFailed: 'Не удалось подключиться к CodeLab. Проверьте соединение.',
      agentsLoadFailed: 'Не удалось загрузить агентов: ошибка валидации данных. Некоторые агенты могут не отображаться.',
      projectInitFailed: 'Не удалось инициализировать проект: {message}'
    },
    info: {
      connected: 'Подключено к CodeLab',
      projectInitialized: 'Проект CodeLab успешно инициализирован',
      sessionCreated: 'Создана новая сессия чата',
      sessionDeleted: 'Сессия удалена',
      codeCopied: 'Код скопирован в буфер обмена'
    }
  }
};

export function t(key: string, params?: Record<string, any>): string {
  const locale = vscode.env.language.startsWith('ru') ? 'ru' : 'en';
  const keys = key.split('.');
  let message: any = messages[locale];
  
  for (const k of keys) {
    message = message?.[k];
  }
  
  if (typeof message !== 'string') {
    return key;
  }
  
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      message = message.replace(`{${k}}`, String(v));
    });
  }
  
  return message;
}
