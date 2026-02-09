# TypeScript Migration Guide

This guide documents the patterns and best practices used when migrating JavaScript to TypeScript in the LocalBrowser Playwright project.

## Overview

The migration from JavaScript to TypeScript provides:
- Compile-time type checking
- Better IDE support (autocomplete, refactoring)
- Self-documenting code through type annotations
- Early bug detection

## Migration Patterns

### 1. Function Conversion

**JavaScript:**
```javascript
function executeCode(code) {
  if (!code || typeof code !== 'string') {
    throw new Error('Code is required');
  }
  return browserHelper.executeCode(code);
}
```

**TypeScript:**
```typescript
import { BrowserHelper } from '../types/browser';

export async function executeCode(
  req: Request<{}, {}, { code: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { code } = req.body;

  if (!code || typeof code !== 'string') {
    throw new ValidationError('Code is required', { field: 'code' });
  }

  try {
    const result = await getBrowserHelper().executeCode(code);
    res.json({ result });
  } catch (err) {
    console.error('[BrowserController] Execute error:', err);
    await logErrorToDB({
      type: 'EXECUTE_FAILED',
      message: (err as Error).message,
      stack: (err as Error).stack,
      route: '/browser/execute',
      input: req.body,
    });
    next(err);
  }
}
```

### 2. Request Validation Pattern

**Pattern:** Use Zod schemas for runtime validation with type inference.

```typescript
import { z } from 'zod';
import { validateInput } from '../validators/schemas';

const executeCodeSchema = z.object({
  code: z.string()
    .min(1, 'Code cannot be empty')
    .max(10000, 'Code too long'),
});

export async function execute(req: Request, res: Response, next: NextFunction) {
  const validation = validateInput(executeCodeSchema, req.body);
  
  if (!validation.success) {
    throw new ValidationError('Invalid request body', {
      errors: validation.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // TypeScript knows validation.data has type: { code: string }
  const { code } = validation.data;
  // ... rest of handler
}
```

### 3. Error Handling Pattern

**Custom Error Classes:**

```typescript
// types/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public errors?: Array<{ field: string; message: string }>
  ) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class BrowserError extends AppError {
  constructor(
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message, 500, 'BROWSER_ERROR');
    this.name = 'BrowserError';
  }
}
```

**Error Handler Middleware:**

```typescript
// middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../types/errors';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof ValidationError) {
    return res.status(400).json({
      error: err.message,
      code: err.code,
      details: err.errors,
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
  }

  // Unknown error
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
}
```

### 4. Query Parameter Parsing

```typescript
interface VisitQueryParams {
  url: string;
  returnHtml?: string;
  saveToFile?: string;
  waitUntil?: string;
  timeout?: string;
  handleCloudflare?: string;
  useProgressiveRetry?: string;
}

export async function visit(
  req: Request<{}, {}, {}, VisitQueryParams>,
  res: Response,
  next: NextFunction
): Promise<void> {
  const url = req.query.url;

  // Validate URL
  if (!url || typeof url !== 'string' || !/^https?:\/\//.test(url)) {
    throw new ValidationError('Valid URL (http/https) is required', { field: 'url' });
  }

  // Parse options with defaults
  const options: VisitOptions = {
    returnHtml: req.query.returnHtml === 'true',
    saveToFile: req.query.saveToFile !== 'false',
    waitUntil: (req.query.waitUntil as VisitOptions['waitUntil']) || 'networkidle',
    timeout: parseInt(req.query.timeout || '60000', 10),
    handleCloudflare: req.query.handleCloudflare !== 'false',
    useProgressiveRetry: req.query.useProgressiveRetry !== 'false',
  };
  // ... rest of handler
}
```

### 5. Dependency Injection Pattern

**For Class-Based Controllers:**

```typescript
interface LoggerInterface {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

interface InternalControllerDependencies {
  taskExecutor?: {
    execute(task: LaravelTask): Promise<{ success: boolean; result?: unknown; error?: string }>;
  };
  resultSubmitter?: {
    submit(result: TaskResultPayload): Promise<void>;
  };
  taskQueueService?: {
    getPendingTasks(limit: number): Promise<LaravelTask[]>;
  };
  logger?: LoggerInterface;
}

export class InternalController {
  private taskExecutor?: InternalControllerDependencies['taskExecutor'];
  private resultSubmitter?: InternalControllerDependencies['resultSubmitter'];
  private taskQueueService?: InternalControllerDependencies['taskQueueService'];
  private logger: LoggerInterface;

  constructor(dependencies: InternalControllerDependencies = {}) {
    this.taskExecutor = dependencies.taskExecutor;
    this.resultSubmitter = dependencies.resultSubmitter;
    this.taskQueueService = dependencies.taskQueueService;
    this.logger = dependencies.logger || defaultLogger;
  }
  // ... methods
}
```

### 6. Type Guards

```typescript
// Using type guards for union types
interface SuccessResult<T> {
  success: true;
  data: T;
}

interface ErrorResult {
  success: false;
  errors: ZodError;
}

type ValidationResult<T> = SuccessResult<T> | ErrorResult;

function isSuccessResult<T>(result: ValidationResult<T>): result is SuccessResult<T> {
  return result.success === true;
}

// Usage
const validation = validateInput(schema, input);
if (isSuccessResult(validation)) {
  // TypeScript knows validation.data has type T
  console.log(validation.data);
}
```

### 7. Dynamic Imports

When using dynamic imports with mocks in tests:

```typescript
// Controller (original)
export async function download(req: Request, res: Response, next: NextFunction) {
  try {
    const { getHtmlFile } = await import('../helpers/browserHelper.js');
    const fileData = await getHtmlFile(fileId);
    // ... rest of handler
  } catch (err) {
    next(err);
  }
}

// Test (mocking)
jest.mock('../helpers/browserHelper', () => ({
  browserHelper: { /* ... */ },
  getHtmlFile: jest.fn().mockResolvedValue(mockFileData),
}));

it('should download file successfully', async () => {
  const mockRequest = { params: { fileId: 'test-123' } };
  await controller.download(mockRequest as any, mockResponse as Response);
  expect(getHtmlFile).toHaveBeenCalledWith('test-123');
});
```

## Common Type Conversions

| JavaScript | TypeScript |
|------------|-----------|
| `any` | Specific types or `unknown` |
| `{}` | `Record<string, unknown>` |
| `[]` | `unknown[]` or specific array type |
| `null` | `null` or `T \| null` |
| `undefined` | `undefined` or `T \| undefined` |
| Function callbacks | `() => void` or specific signature |
| `arguments` | Rest parameters or `...args: T[]` |

## Best Practices

### 1. Enable Strict Mode
Always enable strict mode in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

### 2. Use Type Inference
Let TypeScript infer types when obvious:
```typescript
const results = await database.query('SELECT * FROM users');
// TypeScript infers results type
```

### 3. Prefer Interfaces for Objects
Use interfaces for object shapes:
```typescript
interface User {
  id: string;
  name: string;
  email: string;
}
```

### 4. Use Type Aliases for Unions
Use type aliases for union types:
```typescript
type Status = 'pending' | 'processing' | 'completed' | 'failed';
```

### 5. Export Types from Modules
Export types for external use:
```typescript
// types/common.ts
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export type { ApiResponse };
```

### 6. Use Branded Types for IDs
Prevent type confusion with branded types:
```typescript
type UserId = string & { readonly brand: unique symbol };
function createUserId(id: string): UserId {
  return id as UserId;
}
```

### 7. Document Complex Types
Add JSDoc comments for complex types:
```typescript
/**
 * Task result payload from worker
 * @property task_id - Unique identifier for the task
 * @property success - Whether the task completed successfully
 * @property result - The result data if successful
 * @property error - Error message if failed
 */
interface TaskResultPayload {
  task_id: string;
  success: boolean;
  result?: unknown;
  error?: string;
}
```

## Testing TypeScript Code

### Unit Testing Controllers

```typescript
describe('BrowserController', () => {
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  it('should validate URL parameter', async () => {
    const mockRequest = {
      query: { url: 'invalid-url' },
    };

    await expect(
      browserController.visit(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      )
    ).rejects.toThrow('Valid URL');
  });
});
```

### Mocking Dependencies

```typescript
// Mock browser helper
const mockBrowserHelper = {
  executeCode: jest.fn(),
  visitUrl: jest.fn(),
};

jest.mock('../helpers/browserHelper', () => ({
  browserHelper: mockBrowserHelper,
}));
```

## Next Steps

1. **Migrate remaining JavaScript files:**
   - `utils/*.js` → `utils/*.ts`
   - `services/*.js` → `services/*.ts`
   - `middleware/*.js` → `middleware/*.ts`

2. **Add more tests:**
   - Integration tests for API routes
   - E2E tests for critical flows

3. **Generate API documentation:**
   - Configure TypeDoc
   - Add JSDoc comments to all public APIs

4. **Enable stricter linting:**
   - `no-explicit-any`: Error
   - `no-unused-vars`: Error
   - `prefer-const`: Error
