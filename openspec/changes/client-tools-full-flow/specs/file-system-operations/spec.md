# Спецификация: File System Operations

## Описание

FileSystemExecutor обеспечивает безопасное выполнение файловых операций на клиенте:
- `read_file` - чтение файла
- `write_file` - запись файла
- `list_directory` - список файлов в директории

Включает валидацию путей, проверку размера файла, работу с permissions и обработку ошибок.

## FileSystemExecutor класс (src/tools/executors/file-system.ts)

### Constructor

```typescript
constructor(
  private pathValidator: PathValidator,
  private logger: Logger,
  config?: FileSystemConfig
)
```

Параметры:
- `pathValidator`: PathValidator инстанс для валидации путей
- `logger`: Logger для отладки
- `config`: опциональная конфигурация (max file size, encoding defaults)

### FileSystemConfig

```typescript
interface FileSystemConfig {
  maxFileSizeBytes?: number  // default 100 * 1024 * 1024 (100MB)
  defaultEncoding?: string   // default 'utf-8'
  followSymlinks?: boolean   // default true (но с workspace boundary check)
}
```

## Методы

### executeReadFile(args)

Чтение содержимого файла.

**Аргументы:**
```typescript
args: {
  path: string              // Путь к файлу (обязательный)
  encoding?: string         // Кодировка (default utf-8)
}
```

**Процесс выполнения:**

1. **Валидация пути**
   ```
   pathValidator.validatePath(args.path)
   ```
   - Если невалиден: выбросить PathValidationError
   - Проверяет: traversal, workspace boundary, symlinks, file size

2. **Получить файл**
   ```typescript
   const resolvedPath = await this.pathValidator.resolvePath(args.path)
   ```

3. **Проверить что это файл (не директория)**
   ```typescript
   const stats = await vscode.workspace.fs.stat(Uri.file(resolvedPath))
   if (stats.type !== FileType.File) {
     throw new FileOperationError('Not a file')
   }
   ```

4. **Прочитать содержимое**
   ```typescript
   const fileContent = await vscode.workspace.fs.readFile(
     Uri.file(resolvedPath)
   )
   ```

5. **Декодировать с помощью указанной кодировки**
   ```typescript
   const text = Buffer.from(fileContent).toString(
     args.encoding || this.config.defaultEncoding
   )
   ```

6. **Логирование**
   ```
   Info: "Read file: {path} ({size} bytes)"
   ```

7. **Return результат**
   ```typescript
   return {
     status: 'success',
     output: text,
     metadata: {
       size_bytes: text.length,
       encoding: args.encoding || this.config.defaultEncoding
     }
   }
   ```

**Обработка ошибок:**
- FileNotFoundError → return error result
- PermissionDeniedError → return error result
- EncodingError → return error result
- PathValidationError → return error result

### executeWriteFile(args)

Запись содержимого в файл.

**Аргументы:**
```typescript
args: {
  path: string              // Путь к файлу (обязательный)
  content: string           // Содержимое для записи (обязательный)
  encoding?: string         // Кодировка (default utf-8)
  createIfMissing?: boolean // Создать если не существует (default true)
}
```

**Процесс выполнения:**

1. **Валидация пути**
   ```
   pathValidator.validatePath(args.path)
   ```

2. **Получить resolved path**
   ```typescript
   const resolvedPath = await this.pathValidator.resolvePath(args.path)
   ```

3. **Проверить что директория существует**
   ```typescript
   const dirPath = path.dirname(resolvedPath)
   const dirStats = await vscode.workspace.fs.stat(Uri.file(dirPath))
   if (dirStats.type !== FileType.Directory) {
     throw new FileOperationError('Parent directory not found')
   }
   ```

4. **Проверить что файл не существует или файл (не директория)**
   ```typescript
   try {
     const stats = await vscode.workspace.fs.stat(Uri.file(resolvedPath))
     if (stats.type === FileType.Directory) {
       throw new FileOperationError('Is a directory')
     }
   } catch (e) {
     if (e.code !== 'FileNotFound' && !args.createIfMissing) {
       throw e
     }
   }
   ```

5. **Закодировать содержимое**
   ```typescript
   const buffer = Buffer.from(
     args.content,
     args.encoding || this.config.defaultEncoding
   )
   ```

6. **Проверить размер**
   ```typescript
   if (buffer.length > this.config.maxFileSizeBytes) {
     throw new FileOperationError('File size exceeds limit')
   }
   ```

7. **Записать файл**
   ```typescript
   await vscode.workspace.fs.writeFile(
     Uri.file(resolvedPath),
     buffer
   )
   ```

8. **Логирование**
   ```
   Info: "Wrote file: {path} ({size} bytes)"
   ```

9. **Return результат**
   ```typescript
   return {
     status: 'success',
     output: { path: resolvedPath, size_bytes: buffer.length },
     metadata: {
       created: !existedBefore,
       size_bytes: buffer.length,
       encoding: args.encoding || this.config.defaultEncoding
     }
   }
   ```

**Обработка ошибок:**
- PathValidationError → return error result
- PermissionDeniedError → return error result
- FileSizeExceededError → return error result
- DirectoryNotFoundError → return error result

### executeListDirectory(args)

Получить список файлов в директории.

**Аргументы:**
```typescript
args: {
  path: string           // Путь к директории (обязательный)
  recursive?: boolean    // Рекурсивный листинг (default false)
  pattern?: string       // Glob pattern для фильтрации (default *)
}
```

**Процесс выполнения:**

1. **Валидация пути**
   ```
   pathValidator.validatePath(args.path)
   ```

2. **Получить resolved path**
   ```typescript
   const resolvedPath = await this.pathValidator.resolvePath(args.path)
   ```

3. **Проверить что это директория**
   ```typescript
   const stats = await vscode.workspace.fs.stat(Uri.file(resolvedPath))
   if (stats.type !== FileType.Directory) {
     throw new FileOperationError('Not a directory')
   }
   ```

4. **Читать содержимое директории**
   ```typescript
   const entries = await vscode.workspace.fs.readDirectory(
     Uri.file(resolvedPath)
   )
   ```

5. **Применить фильтр (если pattern предоставлен)**
   ```typescript
   if (args.pattern) {
     const minimatch = require('minimatch').minimatch
     entries = entries.filter(
       ([name]) => minimatch(name, args.pattern)
     )
   }
   ```

6. **Применить рекурсивный листинг (если нужно)**
   ```typescript
   if (args.recursive) {
     for (const [name, type] of entries) {
       if (type === FileType.Directory) {
         const subPath = path.join(resolvedPath, name)
         const subEntries = await this.executeListDirectory({
           path: subPath,
           recursive: true,
           pattern: args.pattern
         })
         result.entries.push(
           ...subEntries.entries.map(e => ({
             ...e,
             path: path.join(name, e.path)
           }))
         )
       }
     }
   }
   ```

7. **Трансформировать результат**
   ```typescript
   const result = entries.map(([name, type]) => ({
     name,
     type: type === FileType.Directory ? 'directory' : 'file',
     path: path.join(resolvedPath, name)
   }))
   ```

8. **Логирование**
   ```
   Info: "Listed directory: {path} ({count} entries)"
   ```

9. **Return результат**
   ```typescript
   return {
     status: 'success',
     output: {
       path: resolvedPath,
       entries: result,
       total_count: result.length
     },
     metadata: {
       total_count: result.length,
       recursive: args.recursive || false
     }
   }
   ```

**Обработка ошибок:**
- PathValidationError → return error result
- NotADirectoryError → return error result
- PermissionDeniedError → return error result
- DirectoryNotFoundError → return error result

## Типы результатов

### FileReadResult

```typescript
interface FileReadResult {
  status: 'success' | 'error'
  output?: string  // File content
  error?: {
    message: string
    code?: string
  }
  metadata?: {
    size_bytes: number
    encoding: string
  }
}
```

### FileWriteResult

```typescript
interface FileWriteResult {
  status: 'success' | 'error'
  output?: {
    path: string
    size_bytes: number
  }
  error?: {
    message: string
    code?: string
  }
  metadata?: {
    created: boolean
    size_bytes: number
    encoding: string
  }
}
```

### DirectoryListResult

```typescript
interface DirectoryListResult {
  status: 'success' | 'error'
  output?: {
    path: string
    entries: Array<{
      name: string
      type: 'file' | 'directory'
      path: string
    }>
    total_count: number
  }
  error?: {
    message: string
    code?: string
  }
  metadata?: {
    total_count: number
    recursive: boolean
  }
}
```

## Ошибки FileSystemExecutor

### FileOperationError

```typescript
class FileOperationError extends Error {
  constructor(
    message: string,
    public code?: string,
    public path?: string
  )
}
```

Коды ошибок:
- `FILE_NOT_FOUND` - файл не существует
- `NOT_A_FILE` - путь указывает на директорию, ожидалась файл
- `NOT_A_DIRECTORY` - путь указывает на файл, ожидалась директория
- `PERMISSION_DENIED` - нет доступа к файлу/директории
- `FILE_SIZE_EXCEEDED` - размер файла превышает лимит
- `ENCODING_ERROR` - ошибка при кодировании/декодировании
- `PARENT_DIR_NOT_FOUND` - родительская директория не существует

## Интеграция с PathValidator

FileSystemExecutor использует PathValidator для валидации всех путей перед операциями:

```typescript
// Перед любой операцией
const validationResult = await this.pathValidator.validatePath(args.path)
if (!validationResult.valid) {
  throw new PathValidationError(validationResult.error)
}
```

PathValidator проверяет:
- Path traversal (../)
- Workspace boundary
- Symlink resolution (если enabled)
- File size (для read operations)

## Работа с VS Code API

FileSystemExecutor использует VS Code API для файловых операций:

```typescript
import { workspace, Uri, FileType } from 'vscode'

// Read file
const fileUri = Uri.file(path)
const fileContent = await workspace.fs.readFile(fileUri)

// Write file
await workspace.fs.writeFile(fileUri, buffer)

// List directory
const entries = await workspace.fs.readDirectory(directoryUri)

// Get file stats
const stats = await workspace.fs.stat(fileUri)
```

## Обработка путей

FileSystemExecutor работает с абсолютными путями (resolved via PathValidator):

```typescript
import * as path from 'path'

// Resolve relative paths
const resolvedPath = path.resolve(workspacePath, relativePath)

// Get dirname
const dirPath = path.dirname(filePath)

// Get basename
const fileName = path.basename(filePath)

// Join paths
const fullPath = path.join(dirPath, fileName)
```

## Логирование

FileSystemExecutor логирует операции:

**Info уровень:**
- Read file success: "Read file: {path} ({size} bytes)"
- Write file success: "Wrote file: {path} ({size} bytes)"
- List directory success: "Listed directory: {path} ({count} entries)"

**Debug уровень:**
- Path validation details
- File stats details
- Directory entries details

**Error уровень:**
- Validation errors
- File operation errors
- Permission errors

## Кэширование

Опционально, FileSystemExecutor может кэшировать результаты read operations:

```typescript
private readCache: Map<string, {
  content: string
  timestamp: number
}> = new Map()

private isReadCacheValid(path: string, ttl: number): boolean {
  const entry = this.readCache.get(path)
  if (!entry) return false
  return Date.now() - entry.timestamp < ttl
}
```

Кэш можно контролировать через config (enableCaching, cacheTtlMs).

## Тестирование (src/tools/__tests__/file-system.test.ts)

### Unit тесты

1. **executeReadFile**
   - Successfully read existing file
   - Read with different encoding (utf-8, utf-16)
   - File not found error
   - Not a file error (directory)
   - Permission denied error
   - File size exceeded error
   - Encoding error

2. **executeWriteFile**
   - Successfully write new file
   - Successfully overwrite existing file
   - Parent directory not found
   - Permission denied
   - File size exceeded
   - createIfMissing=false with non-existent file

3. **executeListDirectory**
   - Successfully list directory
   - Successfully list with recursive=true
   - Successfully list with pattern filter
   - Not a directory error
   - Directory not found error
   - Permission denied

4. **Path validation**
   - Paths validated before operations
   - Invalid paths rejected
   - Resolved paths used for operations

## Acceptance Criteria

- [ ] FileSystemExecutor класс реализован с методами executeReadFile, executeWriteFile, executeListDirectory
- [ ] Все пути валидируются перед операциями
- [ ] File size limits (100MB) enforced для read и write
- [ ] Кодирование (utf-8, utf-16) поддерживается
- [ ] Recursive listing работает для executeListDirectory
- [ ] Pattern filtering работает для executeListDirectory
- [ ] Все ошибки правильно обработаны и типизированы
- [ ] Логирование работает на всех уровнях
- [ ] VS Code API вызовы правильные
- [ ] Unit тесты покрывают все методы (100% coverage)
