# CodeLab VS Code Plugin

AI-powered coding assistant for VS Code with real-time streaming responses.

## Features

- 💬 **Interactive Chat Interface** - Chat with AI directly in VS Code sidebar
- 🔄 **Real-time Streaming** - Get responses as they're generated using Streaming Fetch API
- 🎯 **Context-Aware** - Automatically includes active file, selection, and diagnostics
- 🛠️ **Code Actions** - Explain, refactor, and fix errors with one click
- 📝 **Diff Preview** - Review changes before applying them
- 🔒 **Secure** - API tokens stored in VS Code SecretStorage

## Installation

1. Install the extension from VS Code Marketplace
2. Set your API token: `Ctrl+Shift+P` → "CodeLab: Set API Token"
3. Configure backend URL in settings (default: `http://localhost:8000`)

## Usage

### Chat Interface

Click the CodeLab icon in the Activity Bar to open the chat interface.

### Commands

- **CodeLab: Open Chat** - Open the chat sidebar
- **CodeLab: Explain Selection** - Explain selected code
- **CodeLab: Refactor Selection** - Get refactoring suggestions
- **CodeLab: Fix Errors** - Fix errors in current file
- **CodeLab: Generate Code** - Generate code from description

### Context Menu

Right-click in the editor to access CodeLab commands for selected code.

## Configuration

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

## Architecture

CodeLab follows a **thin client architecture**:

- **Plugin** - UI, context collection, diff application
- **Backend** - AI processing, code generation, orchestration

### Technology Stack

- **TypeScript 5.9+** - Strict mode, full type safety
- **Zod** - Runtime validation with type inference
- **Fetch API** - Native HTTP client with streaming support
- **React 18.3+** - WebView UI (future enhancement)
- **Vitest** - Fast unit testing

## Development

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Watch mode
npm run watch

# Run tests
npm test

# Package extension
npm run package
```

### Testing

Press `F5` to launch Extension Development Host.

## Requirements

- VS Code 1.109.0 or higher
- Node.js 22.x or higher
- CodeLab backend service running

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines.

## Support

For issues and feature requests, please use GitHub Issues.
