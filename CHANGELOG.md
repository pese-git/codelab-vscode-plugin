# Change Log

All notable changes to the "CodeLab" extension will be documented in this file.

## [0.0.1] - 2026-02-13

### Added
- Initial release of CodeLab VS Code plugin
- Interactive chat interface in sidebar
- Real-time streaming responses using Streaming Fetch API
- Context-aware AI assistance (active file, selection, diagnostics)
- Commands for code explanation, refactoring, and error fixing
- Diff preview and safe code application
- Secure API token storage using VS Code SecretStorage
- Full TypeScript implementation with Zod validation
- Comprehensive error handling and retry logic
- Support for multiple chat sessions
- Context menu integration for quick actions

### Features
- **Chat Interface**: WebView-based chat in Activity Bar sidebar
- **Streaming API**: Real-time responses with progress updates
- **Context Collection**: Automatic gathering of workspace context
- **Code Actions**: Explain, refactor, fix errors, generate code
- **Diff Engine**: Safe application of code changes with preview
- **Commands**: 6 VS Code commands for various AI operations
- **Configuration**: Customizable API settings and context limits

### Technical
- TypeScript 5.9+ with strict mode
- Zod for runtime validation
- Native Fetch API with streaming support
- Thin client architecture
- Comprehensive error handling
- Unit tests with Vitest
