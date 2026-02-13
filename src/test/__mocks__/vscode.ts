// Mock VS Code API for testing
import { vi } from 'vitest';

export const window = {
  showInformationMessage: vi.fn(),
  showErrorMessage: vi.fn(),
  showWarningMessage: vi.fn(),
  createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(),
    show: vi.fn(),
    dispose: vi.fn()
  })),
  createWebviewPanel: vi.fn(),
  showTextDocument: vi.fn(),
  activeTextEditor: undefined,
  visibleTextEditors: []
};

export const workspace = {
  getConfiguration: vi.fn((section?: string) => ({
    get: vi.fn((key: string, defaultValue?: any) => {
      // Mock default configuration values
      const config: Record<string, any> = {
        'codelab.api.baseUrl': 'http://localhost:8000',
        'codelab.api.timeout': 30000,
        'codelab.api.retryAttempts': 3,
        'codelab.api.streamingEnabled': true,
        'codelab.context.maxFileSize': 1048576,
        'codelab.context.maxFiles': 100,
        'codelab.context.maxContextSize': 10485760
      };
      const fullKey = section ? `${section}.${key}` : key;
      return config[fullKey] ?? defaultValue;
    }),
    update: vi.fn(),
    has: vi.fn(() => true)
  })),
  workspaceFolders: [],
  onDidChangeConfiguration: vi.fn(),
  onDidChangeTextDocument: vi.fn(),
  onDidSaveTextDocument: vi.fn(),
  fs: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    stat: vi.fn()
  }
};

export const commands = {
  registerCommand: vi.fn(),
  executeCommand: vi.fn()
};

export const languages = {
  getDiagnostics: vi.fn(() => []),
  registerCodeActionsProvider: vi.fn()
};

export const Uri = {
  file: vi.fn((path: string) => ({ fsPath: path, scheme: 'file', path })),
  parse: vi.fn((uri: string) => ({ fsPath: uri, scheme: 'file', path: uri }))
};

export const Range = class {
  constructor(
    public start: any,
    public end: any
  ) {}
};

export const Position = class {
  constructor(
    public line: number,
    public character: number
  ) {}
};

export const Selection = class extends Range {
  constructor(
    public anchor: any,
    public active: any
  ) {
    super(anchor, active);
  }
};

export const ViewColumn = {
  One: 1,
  Two: 2,
  Three: 3
};

export const StatusBarAlignment = {
  Left: 1,
  Right: 2
};

export const DiagnosticSeverity = {
  Error: 0,
  Warning: 1,
  Information: 2,
  Hint: 3
};

export const ExtensionContext = class {
  subscriptions: any[] = [];
  extensionPath = '';
  globalState = {
    get: vi.fn(),
    update: vi.fn()
  };
  workspaceState = {
    get: vi.fn(),
    update: vi.fn()
  };
  secrets = {
    get: vi.fn(),
    store: vi.fn(),
    delete: vi.fn()
  };
};
