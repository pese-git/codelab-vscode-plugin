# Спецификация: Command Execution

## Описание

CommandExecutor обеспечивает безопасное выполнение shell команд на клиенте:
- Валидация команд через whitelist
- Spawn процесса и управление жизненным циклом
- Timeout protection (SIGTERM + SIGKILL)
- Output streaming и accumulation
- Process signal handling
- Concurrent execution limits

## CommandExecutor класс (src/tools/executors/command.ts)

### Constructor

```typescript
constructor(
  private logger: Logger,
  config?: CommandExecutorConfig
)
```

Параметры:
- `logger`: Logger для отладки
- `config`: опциональная конфигурация

### CommandExecutorConfig

```typescript
interface CommandExecutorConfig {
  timeout?: number              // default 300000 (5 min)
  maxConcurrent?: number        // default 3
  maxOutputBytes?: number       // default 10 * 1024 * 1024 (10MB)
  killTimeout?: number          // default 10000 (10 sec between SIGTERM and SIGKILL)
}
```

## Command Whitelist

Разрешенные команды (по умолчанию):

```typescript
private readonly COMMAND_WHITELIST = [
  // File listing
  'ls', 'find', 'dir',
  
  // File reading
  'cat', 'head', 'tail', 'less', 'more',
  
  // File operations
  'mkdir', 'touch', 'rm', 'rmdir', 'cp', 'mv',
  
  // Version control
  'git',
  
  // Package management
  'npm', 'yarn', 'pnpm',
  
  // Node/Python
  'node', 'python', 'python3',
  
  // Utilities
  'grep', 'sed', 'awk', 'sort', 'uniq', 'wc',
  
  // System
  'pwd', 'whoami', 'echo', 'date'
]
```

Запрещенные команды (всегда блокированы):

```typescript
private readonly COMMAND_BLACKLIST = [
  'sudo', 'su',                    // Privilege escalation
  'rm -rf /',                      // Destructive
  'curl', 'wget', 'nc', 'telnet',  // Network
  'eval', 'exec', 'bash -c',       // Code injection
  'dd', 'mkfs',                    // Dangerous system
  'kill', 'killall',               // Process termination
  'shutdown', 'reboot'             // System control
]
```

## Методы

### executeCommand(args)

Выполнение shell команды.

**Аргументы:**
```typescript
args: {
  command: string        // Имя команды (обязательная)
  args?: string[]        // Аргументы команды (опциональные)
  timeout?: number       // Timeout в ms (опциональный, default 300000)
  cwd?: string           // Working directory (опциональный)
}
```

**Процесс выполнения:**

1. **Валидация команды**
   ```typescript
   const validationResult = this.validateCommand(args.command)
   if (!validationResult.valid) {
     throw new CommandExecutionError('Command not allowed')
   }
   ```

2. **Инкремент concurrent counter**
   ```typescript
   this.concurrentCount++
   if (this.concurrentCount > this.config.maxConcurrent) {
     this.concurrentCount--
     throw new CommandExecutionError('Concurrent limit exceeded')
   }
   ```

3. **Логирование**
   ```
   Info: "Executing command: {command} {args.join(' ')}"
   ```

4. **Spawn процесс**
   ```typescript
   const process = spawn(args.command, args.args || [], {
     cwd: args.cwd || process.cwd(),
     stdio: ['ignore', 'pipe', 'pipe'],
     timeout: args.timeout || this.config.timeout
   })
   ```

5. **Настроить обработчики для stdout/stderr**
   ```typescript
   let output = ''
   let errorOutput = ''
   
   process.stdout.on('data', (chunk) => {
     output += chunk.toString()
     if (output.length > this.config.maxOutputBytes) {
       process.kill('SIGTERM')
       throw new CommandExecutionError('Output size exceeded')
     }
   })
   
   process.stderr.on('data', (chunk) => {
     errorOutput += chunk.toString()
   })
   ```

6. **Настроить timeout handler**
   ```typescript
   const timeout = setTimeout(() => {
     process.kill('SIGTERM')
     
     const killTimeout = setTimeout(() => {
       process.kill('SIGKILL')
     }, this.config.killTimeout)
   }, args.timeout || this.config.timeout)
   ```

7. **Ожидать завершения процесса**
   ```typescript
   const exitCode = await new Promise((resolve, reject) => {
     process.on('exit', (code) => {
       clearTimeout(timeout)
       resolve(code)
     })
     
     process.on('error', (err) => {
       clearTimeout(timeout)
       reject(err)
     })
   })
   ```

8. **Обработать результат**
   ```typescript
   const success = exitCode === 0
   
   return {
     status: success ? 'success' : 'error',
     output: output,
     error: errorOutput,
     exitCode: exitCode,
     metadata: {
       duration_ms: Date.now() - startTime,
       output_size_bytes: Buffer.byteLength(output),
       error_size_bytes: Buffer.byteLength(errorOutput)
     }
   }
   ```

9. **Декремент concurrent counter**
   ```typescript
   this.concurrentCount--
   ```

10. **Логирование результата**
    ```
    Success: "Command executed: {command} (exit code: {exitCode})"
    Error: "Command failed: {command} (exit code: {exitCode})"
    ```

**Обработка ошибок:**
- CommandValidationError → throw
- CommandExecutionError (timeout) → return error result with status='timeout'
- CommandExecutionError (output size) → return error result with status='error'
- ProcessError → return error result
- SignalError (SIGTERM/SIGKILL) → return error result

### validateCommand(command)

Валидация команды перед выполнением.

**Процесс:**

1. **Проверить что команда не в blacklist**
   ```typescript
   if (this.COMMAND_BLACKLIST.includes(command)) {
     return { valid: false, error: 'Command is blacklisted' }
   }
   ```

2. **Проверить что команда в whitelist**
   ```typescript
   const isWhitelisted = this.COMMAND_WHITELIST.includes(command)
   if (!isWhitelisted) {
     return { valid: false, error: 'Command not in whitelist' }
   }
   ```

3. **Return результат**
   ```typescript
   return { valid: true }
   ```

## Типы результатов

### CommandExecutionResult

```typescript
interface CommandExecutionResult {
  status: 'success' | 'error' | 'timeout'
  output?: string           // stdout
  error?: string            // stderr
  exitCode?: number
  metadata?: {
    duration_ms: number
    output_size_bytes: number
    error_size_bytes: number
  }
}
```

## Ошибки CommandExecutor

### CommandExecutionError

```typescript
class CommandExecutionError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown
  )
}
```

Коды ошибок:
- `COMMAND_NOT_FOUND` - команда не найдена
- `COMMAND_BLACKLISTED` - команда в черном списке
- `COMMAND_NOT_WHITELISTED` - команда не в белом списке
- `EXECUTION_FAILED` - ошибка выполнения
- `TIMEOUT` - превышен timeout
- `OUTPUT_SIZE_EXCEEDED` - размер output превышает лимит
- `CONCURRENT_LIMIT_EXCEEDED` - превышен лимит одновременных выполнений

## Process Management

### Lifecycle

```
Spawn Process
      ↓
Attach stdout/stderr handlers
      ↓
Start timeout
      ↓
Wait for exit or timeout
      ↓
Process exits or SIGTERM sent
      ↓
If process still alive after killTimeout:
      ↓
SIGKILL sent
      ↓
Process killed
      ↓
Return result
```

### Signal Handling

**SIGTERM (graceful shutdown)**
- Отправляется при timeout
- Дает процессу 10 сек для graceful shutdown
- Процесс может обработать и завершиться

**SIGKILL (forced termination)**
- Отправляется через 10 сек после SIGTERM
- Принудительное завершение процесса
- Не может быть обработано процессом

### Output Handling

- Максимум 10MB output accumulation
- Если превышено: kill процес и return error
- Stdout и stderr обрабатываются отдельно
- Output трансмитируется в реальном времени (опционально)

## Интеграция с ToolHandler

CommandExecutor используется ToolHandler для execute_command tool:

```typescript
case 'execute_command':
  const result = await this.commandExecutor.executeCommand({
    command: event.args.command,
    args: event.args.args,
    timeout: event.args.timeout || this.config.commandTimeoutMs,
    cwd: event.args.cwd
  })
  break
```

## Логирование

CommandExecutor логирует операции:

**Info уровень:**
- Execute command start: "Executing command: {command} {args}"
- Execute command success: "Command executed: {command} (exit: {code}, duration: {ms})"
- Execute command timeout: "Command timeout: {command} (sent SIGTERM)"

**Debug уровень:**
- Command validation: "Validating command: {command}"
- Process spawn: "Process spawned (pid: {pid})"
- Output chunks: "Received output: {size} bytes"
- Signal sent: "Signal {sig} sent to process"

**Error уровень:**
- Validation error: "Command validation failed: {command}"
- Execution error: "Command execution error: {command}"
- Timeout exceeded: "Command timeout exceeded: {command}"
- Output size exceeded: "Output size exceeded: {command}"

## Тестирование (src/tools/__tests__/command.test.ts)

### Unit тесты

1. **validateCommand**
   - Valid whitelisted commands pass
   - Invalid blacklisted commands fail
   - Non-whitelisted commands fail
   - Case-insensitive matching

2. **executeCommand**
   - Successfully execute simple command (echo)
   - Successfully execute command with args (ls -la)
   - Execute command with custom timeout
   - Command with non-zero exit code
   - Command not found error
   - Timeout exceeded (SIGTERM + SIGKILL)
   - Output size exceeded
   - Concurrent limit exceeded

3. **Output Handling**
   - Stdout captured correctly
   - Stderr captured correctly
   - Output accumulation works
   - Max output size enforced

4. **Process Management**
   - Process spawned correctly
   - stdout/stderr attached
   - Signals sent correctly
   - Process cleaned up after execution

5. **Concurrency Control**
   - Concurrent count increments
   - Concurrent count decrements
   - Max concurrent limit enforced
   - Next in queue processed

### Integration тесты

1. **Command execution flow**
   - Command validated
   - Process spawned
   - Output collected
   - Result returned

2. **Timeout handling**
   - SIGTERM sent after timeout
   - SIGKILL sent after killTimeout
   - Result marked as timeout

3. **Error handling**
   - Validation error thrown
   - Execution error returned
   - Output error handled
   - Concurrency error thrown

## Acceptance Criteria

- [ ] CommandExecutor класс реализован с методом executeCommand
- [ ] Command whitelist определен и валидирует команды
- [ ] Timeout protection работает (SIGTERM + SIGKILL)
- [ ] Output handling (10MB max) работает
- [ ] Concurrent execution limits (max 3) enforced
- [ ] Signal handling правильный (SIGTERM, SIGKILL)
- [ ] Все ошибки правильно обработаны и типизированы
- [ ] Логирование работает на всех уровнях
- [ ] Process cleanup правильный
- [ ] Unit и integration тесты покрывают все сценарии (100% coverage)
