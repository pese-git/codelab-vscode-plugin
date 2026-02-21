# Спецификация: Path Validation

## Описание

PathValidator обеспечивает безопасную валидацию путей файлов перед выполнением любых файловых операций:
- Защита от path traversal (../ атак)
- Проверка workspace boundary
- Разрешение symlinks с проверкой границ
- Проверка размера файла
- Проверка permissions
- Нормализация путей

## PathValidator класс (src/tools/validators/path.ts)

### Constructor

```typescript
constructor(
  private workspaceRoot: string,
  private logger: Logger,
  config?: PathValidatorConfig
)
```

Параметры:
- `workspaceRoot`: корневая директория workspace (от VS Code)
- `logger`: Logger для отладки
- `config`: опциональная конфигурация

### PathValidatorConfig

```typescript
interface PathValidatorConfig {
  maxFileSizeBytes?: number      // default 100 * 1024 * 1024 (100MB)
  followSymlinks?: boolean       // default true
  allowedExtensions?: string[]   // опциональный whitelist расширений
  blockedPatterns?: string[]     // опциональный blacklist путей
}
```

## Методы

### validatePath(path)

Полная валидация пути перед операцией.

**Аргументы:**
```typescript
path: string
```

**Процесс выполнения:**

1. **Нормализовать путь**
   ```typescript
   const normalizedPath = this.normalizePath(path)
   ```

2. **Проверить что путь не пуст**
   ```typescript
   if (!normalizedPath || normalizedPath.length === 0) {
     return { valid: false, error: 'Empty path' }
   }
   ```

3. **Разрешить путь (resolve symlinks)**
   ```typescript
   const resolvedPath = await this.resolvePath(normalizedPath)
   if (!resolvedPath) {
     return { valid: false, error: 'Path resolution failed' }
   }
   ```

4. **Проверить workspace boundary**
   ```typescript
   const isInWorkspace = this.validateWorkspaceBoundary(resolvedPath)
   if (!isInWorkspace) {
     return { valid: false, error: 'Path outside workspace' }
   }
   ```

5. **Проверить блокированные паттерны**
   ```typescript
   const isBlocked = this.isPathBlocked(resolvedPath)
   if (isBlocked) {
     return { valid: false, error: 'Path matches blocked pattern' }
   }
   ```

6. **Логирование**
   ```
   Debug: "Path validation: {original_path} -> {resolved_path} (valid)"
   ```

7. **Return результат**
   ```typescript
   return { 
     valid: true, 
     resolved_path: resolvedPath 
   }
   ```

**Обработка ошибок:**
- Если путь невалиден: return { valid: false, error: message }
- Логировать все невалидные пути
- Не выбрасывать исключения

### validateWorkspaceBoundary(path)

Проверка что путь находится в пределах workspace.

**Процесс:**

1. **Получить абсолютные пути**
   ```typescript
   const absPath = path.isAbsolute(path) ? path : path.resolve(this.workspaceRoot, path)
   const absWorkspace = path.resolve(this.workspaceRoot)
   ```

2. **Нормализовать обе пути (remove trailing slashes)**
   ```typescript
   const normalizedPath = absPath.replace(/\/$/, '')
   const normalizedWorkspace = absWorkspace.replace(/\/$/, '')
   ```

3. **Проверить что путь начинается с workspace**
   ```typescript
   const isInBoundary = normalizedPath.startsWith(normalizedWorkspace + path.sep) 
     || normalizedPath === normalizedWorkspace
   ```

4. **Return результат**
   ```typescript
   return isInBoundary
   ```

**Примеры:**
- workspace: `/home/user/project`
- `/home/user/project/file.ts` → valid
- `/home/user/project/src/../main.ts` → valid (после resolve)
- `/home/user/other/file.ts` → invalid
- `/home/user/project/..` → invalid (after resolve)

### resolvePath(path)

Разрешение пути с поддержкой symlinks.

**Процесс:**

1. **Нормализовать путь**
   ```typescript
   let normalizedPath = path.normalize(path)
   ```

2. **Преобразовать в абсолютный путь**
   ```typescript
   if (!path.isAbsolute(normalizedPath)) {
     normalizedPath = path.resolve(this.workspaceRoot, normalizedPath)
   }
   ```

3. **Если symlink разрешен: разрешить его**
   ```typescript
   if (this.config.followSymlinks) {
     try {
       const realPath = fs.realpathSync(normalizedPath)
       
       // Проверить что результирующий путь все еще в workspace
       if (!this.validateWorkspaceBoundary(realPath)) {
         throw new PathValidationError('Symlink points outside workspace')
       }
       
       return realPath
     } catch (e) {
       // Если symlink не может быть разрешен, использовать нормализованный путь
       return normalizedPath
     }
   }
   ```

4. **Если symlink запрещен: просто нормализовать**
   ```typescript
   return normalizedPath
   ```

5. **Логирование**
   ```
   Debug: "Resolved path: {input} -> {output}"
   ```

### checkFileSize(path, maxSize?)

Проверка размера файла перед read операцией.

**Процесс:**

1. **Получить file stats**
   ```typescript
   const stats = await vscode.workspace.fs.stat(Uri.file(path))
   ```

2. **Получить размер файла**
   ```typescript
   const fileSize = stats.size
   ```

3. **Сравнить с лимитом**
   ```typescript
   const limit = maxSize || this.config.maxFileSizeBytes
   if (fileSize > limit) {
     return {
       valid: false,
       error: `File size ${fileSize} exceeds limit ${limit}`
     }
   }
   ```

4. **Return результат**
   ```typescript
   return { valid: true, size: fileSize }
   ```

### checkPermissions(path, operation)

Проверка permissions для операции.

**Параметры:**
```typescript
path: string
operation: 'read' | 'write' | 'execute'
```

**Процесс:**

1. **Получить file stats**
   ```typescript
   const stats = await vscode.workspace.fs.stat(Uri.file(path))
   ```

2. **Проверить permissions через VS Code API**
   ```typescript
   try {
     if (operation === 'read') {
       // Try to read file to verify read permission
       await vscode.workspace.fs.readFile(Uri.file(path))
       return { valid: true }
     } else if (operation === 'write') {
       // Check if file is in read-only workspace
       // (VS Code API doesn't expose direct permission checks)
       return { valid: true }
     }
   } catch (e) {
     return { valid: false, error: 'Permission denied' }
   }
   ```

3. **Return результат**
   ```typescript
   return { valid: true }
   ```

### isPathBlocked(path)

Приватный метод для проверки блокированных паттернов.

**Процесс:**

1. **Получить basename**
   ```typescript
   const basename = path.basename(path)
   ```

2. **Проверить стандартные блокированные паттерны**
   ```typescript
   const defaultBlocked = [
     '.git/config',           // Git config
     '.env',                  // Environment files
     'package.json',          // Package files
     'tsconfig.json',
     '.vscode/settings.json'
   ]
   ```

3. **Проверить кастомные блокированные паттерны**
   ```typescript
   const blockedPatterns = this.config.blockedPatterns || []
   
   for (const pattern of [...defaultBlocked, ...blockedPatterns]) {
     if (minimatch(path, pattern)) {
       return true
     }
   }
   ```

4. **Return результат**
   ```typescript
   return false
   ```

### normalizePath(input)

Приватный метод для нормализации пути.

**Процесс:**

1. **Удалить пробелы**
   ```typescript
   const trimmed = input.trim()
   ```

2. **Нормализовать separators (на платформе)**
   ```typescript
   const normalized = trimmed.replace(/\\/g, '/')
   ```

3. **Удалить trailing slash**
   ```typescript
   const noTrailing = normalized.replace(/\/$/, '')
   ```

4. **Collapse multiple slashes**
   ```typescript
   const collapsed = noTrailing.replace(/\/+/g, '/')
   ```

5. **Return результат**
   ```typescript
   return collapsed
   ```

## Типы результатов

### ValidationResult

```typescript
interface ValidationResult {
  valid: boolean
  error?: string
  resolved_path?: string
  size?: number
}
```

## Ошибки PathValidator

### PathValidationError

```typescript
class PathValidationError extends Error {
  constructor(
    message: string,
    public code?: string
  )
}
```

Коды ошибок:
- `EMPTY_PATH` - пустой путь
- `INVALID_CHARACTERS` - недопустимые символы
- `PATH_TRAVERSAL` - попытка path traversal
- `OUTSIDE_WORKSPACE` - путь вне workspace
- `SYMLINK_OUTSIDE_WORKSPACE` - symlink указывает вне workspace
- `FILE_SIZE_EXCEEDED` - размер файла превышает лимит
- `PERMISSION_DENIED` - нет доступа к файлу
- `BLOCKED_PATTERN` - путь соответствует блокированному паттерну

## Path Traversal Protection

### Примеры атак и защита

**Атака 1: Прямой traversal**
```
Input: /home/user/project/../../etc/passwd
Process:
  1. Normalize: /home/user/project/../../etc/passwd
  2. Resolve: /home/etc/passwd (или /etc/passwd depending on resolve)
  3. Check workspace boundary: /home/etc/passwd не в /home/user/project
  4. Result: INVALID
```

**Атака 2: URL encoding**
```
Input: /home/user/project/%2e%2e/etc/passwd
Process:
  1. Normalize: /home/user/project/../etc/passwd (decode)
  2. Resolve: /home/user/etc/passwd
  3. Check workspace boundary: /home/user/etc/passwd не в /home/user/project
  4. Result: INVALID
```

**Атака 3: Symlink**
```
Input: /home/user/project/link (где link -> /etc/passwd)
Process:
  1. Normalize: /home/user/project/link
  2. Resolve: /etc/passwd (если followSymlinks=true)
  3. Check workspace boundary: /etc/passwd не в /home/user/project
  4. Result: INVALID
```

**Легитимный запрос**
```
Input: src/main.ts
Process:
  1. Normalize: src/main.ts
  2. Resolve: /home/user/project/src/main.ts
  3. Check workspace boundary: в /home/user/project
  4. Result: VALID
```

## Логирование

PathValidator логирует операции:

**Debug уровень:**
- Path validation: "Validating path: {path}"
- Path resolution: "Resolved path: {input} -> {output}"
- Workspace boundary check: "Checking workspace boundary: {path}"
- File size check: "File size: {size} bytes (limit: {limit})"

**Error уровень:**
- Validation failure: "Path validation failed: {path} ({reason})"
- Path traversal detected: "Path traversal detected: {path}"
- Outside workspace: "Path outside workspace: {path}"
- Size exceeded: "File size exceeded: {path} ({size} > {limit})"

## Тестирование (src/tools/validators/__tests__/path.test.ts)

### Unit тесты

1. **normalizePath**
   - Trim whitespace
   - Normalize separators
   - Remove trailing slashes
   - Collapse multiple slashes

2. **resolvePath**
   - Resolve relative paths
   - Resolve absolute paths
   - Resolve symlinks (if enabled)
   - Handle symlink outside workspace

3. **validateWorkspaceBoundary**
   - Valid path in workspace
   - Invalid path outside workspace
   - Root path valid
   - Parent directory invalid

4. **checkFileSize**
   - File size within limit
   - File size exceeds limit
   - File not found error

5. **checkPermissions**
   - Read permission granted
   - Write permission granted
   - Permission denied

6. **isPathBlocked**
   - Blocked .git/config
   - Blocked .env
   - Blocked blocked patterns
   - Allowed paths

7. **validatePath (full validation)**
   - Valid path passes
   - Path traversal rejected
   - Symlink outside workspace rejected
   - Blocked pattern rejected
   - File size exceeded rejected
   - Permission denied rejected

### Security тесты

1. **Path Traversal**
   - Reject `../../../etc/passwd`
   - Reject `src/../../../etc/passwd`
   - Reject URL encoded traversal

2. **Symlink Security**
   - Reject symlink outside workspace
   - Accept symlink inside workspace
   - Handle circular symlinks

3. **Normalization**
   - Handle double slashes
   - Handle mixed separators
   - Handle whitespace

## Acceptance Criteria

- [ ] PathValidator класс реализован со всеми методами
- [ ] Path traversal защита работает (reject ../)
- [ ] Workspace boundary проверка работает
- [ ] Symlink разрешение работает с boundary check
- [ ] File size checks (100MB max) работают
- [ ] Permission checks работают
- [ ] Blocked patterns (default и custom) работают
- [ ] Все ошибки типизированы (PathValidationError)
- [ ] Логирование работает на всех уровнях
- [ ] Security тесты покрывают все attack vectors
- [ ] Unit тесты покрывают все методы (100% coverage)
