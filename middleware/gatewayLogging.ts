/**
 * Logging Middleware
 * Request correlation ID generation/propagation, structured JSON logging, and sensitive data masking
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Structured log entry
 */
export interface StructuredLogEntry {
  /** Timestamp in ISO format */
  timestamp: string;

  /** Log level */
  level: LogLevel;

  /** Message */
  message: string;

  /** Correlation ID for distributed tracing */
  correlationId: string;

  /** Request ID */
  requestId?: string;

  /** Command being executed */
  commandId?: string;

  /** Client information */
  clientId?: string;
  apiKeyId?: string;

  /** Request information */
  method?: string;
  path?: string;
  ip?: string;
  userAgent?: string;

  /** Response information */
  statusCode?: number;
  responseTime?: number;

  /** Error information */
  errorInfo?: {
    message: string;
    code?: string;
    stack?: string;
  };

  /** Additional metadata */
  metadata?: Record<string, unknown>;

  /** Session information */
  sessionId?: string;

  /** User information */
  userId?: string;

  /** Request body (masked) */
  body?: Record<string, unknown>;
}

/**
 * Extended Express Request with logging context
 */
export interface LoggedRequest extends Request {
  correlationId?: string;
  requestId?: string;
  logContext?: Partial<StructuredLogEntry>;
  startTime?: number;
}

// ============================================================================
// Sensitive Data Masking
// ============================================================================

/**
 * Fields to mask in logs
 */
const SENSITIVE_FIELDS = new Set([
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'access_token',
  'refresh_token',
  'api_key',
  'apikey',
  'authorization',
  'ssn',
  'social_security',
  'credit_card',
  'cvv',
  'card_number',
]);

/**
 * Mask a value for logging
 */
function maskValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    // Check if the string contains sensitive patterns
    if (value.match(/\d{3}-\d{2}-\d{4}/)) {
      return '***-**-****';
    }
    if (value.match(/^(?:4[0-9]{12}|5[1-5][0-9]{14}|3[47][0-9]{13})/)) {
      return '****-****-****-****';
    }
    return value;
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return maskObject(value as Record<string, unknown>);
  }

  if (Array.isArray(value)) {
    return value.map(item => maskValue(item));
  }

  return value;
}

/**
 * Mask sensitive fields in an object
 */
export function maskObject(obj: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    if (SENSITIVE_FIELDS.has(lowerKey)) {
      masked[key] = '***MASKED***';
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskValue(value);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

/**
 * Mask sensitive fields in request body
 */
export function maskRequestBody(
  body: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!body || typeof body !== 'object') {
    return body;
  }

  return maskObject(body as Record<string, unknown>);
}

// ============================================================================
// Correlation ID Management
// ============================================================================

/**
 * Generate a new correlation ID
 */
export function generateCorrelationId(): string {
  return `corr_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

/**
 * Get correlation ID from request (header or generate)
 */
export function getCorrelationId(req: LoggedRequest): string {
  // Check header first
  const headerId = req.headers['x-correlation-id'] as string;
  if (headerId) {
    return headerId;
  }

  // Check existing request context
  if (req.correlationId) {
    return req.correlationId;
  }

  // Generate new
  const newId = generateCorrelationId();
  req.correlationId = newId;
  return newId;
}

// ============================================================================
// Structured Logger
// ============================================================================

/**
 * Create a structured log entry
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  context: Partial<StructuredLogEntry> = {}
): StructuredLogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    correlationId: context.correlationId || 'unknown',
    ...context,
  };
}

/**
 * Log at debug level
 */
export function logDebug(message: string, context?: Partial<StructuredLogEntry>): void {
  if (process.env.LOG_LEVEL !== 'debug' && process.env.NODE_ENV === 'production') {
    return;
  }
  const entry = createLogEntry(LogLevel.DEBUG, message, context);
  console.log(JSON.stringify(entry));
}

/**
 * Log at info level
 */
export function logInfo(message: string, context?: Partial<StructuredLogEntry>): void {
  const entry = createLogEntry(LogLevel.INFO, message, context);
  console.log(JSON.stringify(entry));
}

/**
 * Log at warn level
 */
export function logWarn(message: string, context?: Partial<StructuredLogEntry>): void {
  const entry = createLogEntry(LogLevel.WARN, message, context);
  console.warn(JSON.stringify(entry));
}

/**
 * Log at error level
 */
export function logError(message: string, context?: Partial<StructuredLogEntry>): void {
  const entry = createLogEntry(LogLevel.ERROR, message, context);
  console.error(JSON.stringify(entry));
}

/**
 * Log a request
 */
export function logRequest(req: LoggedRequest, level: LogLevel = LogLevel.INFO): void {
  const correlationId = getCorrelationId(req);

  const context: Partial<StructuredLogEntry> = {
    correlationId,
    requestId: req.requestId,
    commandId: (req as { commandId?: string }).commandId,
    method: req.method,
    path: req.path,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('user-agent'),
    clientId: (req as { clientId?: string }).clientId,
    apiKeyId: (req as { apiKeyId?: string }).apiKeyId,
  };

  const logMessage = `${req.method} ${req.path}`;

  if (level === LogLevel.DEBUG) {
    logDebug(logMessage, {
      ...context,
      body: maskRequestBody(req.body as Record<string, unknown>),
    });
  } else {
    logInfo(logMessage, context);
  }
}

/**
 * Log a response
 */
export function logResponse(req: LoggedRequest, res: Response, _startTime: number): void {
  const correlationId = getCorrelationId(req);
  const responseTime = Date.now() - _startTime;

  const context: Partial<StructuredLogEntry> = {
    correlationId,
    requestId: req.requestId,
    commandId: (req as { commandId?: string }).commandId,
    statusCode: res.statusCode,
    responseTime,
  };

  const level = res.statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
  const logMessage = `${req.method} ${req.path} ${res.statusCode} ${responseTime}ms`;

  if (level === LogLevel.WARN) {
    logWarn(logMessage, context);
  } else {
    logInfo(logMessage, context);
  }
}

/**
 * Log an error
 */
export function logErrorException(
  error: Error,
  req: LoggedRequest,
  context?: Partial<StructuredLogEntry>
): void {
  const correlationId = getCorrelationId(req);

  logError(`[${error.name}] ${error.message}`, {
    correlationId,
    requestId: req.requestId,
    commandId: (req as { commandId?: string }).commandId,
    errorInfo: {
      message: error.message,
      stack: error.stack,
    },
    ...context,
  });
}

// ============================================================================
// Middleware Implementation
// ============================================================================

/**
 * Request Logging Middleware
 *
 * Logs incoming requests with correlation ID and masked sensitive data
 */
export function requestLogging(req: LoggedRequest, _res: Response, next: NextFunction): void {
  // Generate or extract correlation ID
  req.correlationId = getCorrelationId(req);

  // Generate request ID
  req.requestId =
    (req.headers['x-request-id'] as string) ||
    `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  // Record start time
  req.startTime = Date.now();

  // Initialize log context
  req.logContext = {
    correlationId: req.correlationId,
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('user-agent'),
  };

  // Add correlation ID to response headers
  _res.set('X-Correlation-ID', req.correlationId);
  _res.set('X-Request-ID', req.requestId);

  // Log request
  logRequest(req, LogLevel.DEBUG);

  next();
}

/**
 * Response Logging Middleware
 *
 * Logs response completion with timing
 */
export function responseLogging(req: LoggedRequest, _res: Response, next: NextFunction): void {
  const startTime = req.startTime || Date.now();

  // Capture response
  const originalSend = _res.send.bind(_res);
  const originalJson = _res.json.bind(_res);

  _res.send = function (body: unknown): Response {
    logResponse(req, _res, startTime);
    return originalSend(body as string);
  };

  _res.json = function (data: unknown): Response {
    logResponse(req, _res, startTime);
    return originalJson(data);
  };

  next();
}

/**
 * Combined Request/Response Logging Middleware
 */
export function logging() {
  return [requestLogging, responseLogging];
}

/**
 * Audit Trail Middleware
 *
 * Creates an audit trail for compliance
 */
export function auditTrail(options?: {
  includeBody?: boolean;
  includeHeaders?: boolean;
  sensitiveHeaders?: string[];
}) {
  const opts = {
    includeBody: options?.includeBody ?? false,
    includeHeaders: options?.includeHeaders ?? false,
    sensitiveHeaders: options?.sensitiveHeaders ?? ['authorization', 'x-api-key', 'cookie'],
  };

  return function (req: LoggedRequest, _res: Response, next: NextFunction): void {
    const correlationId = getCorrelationId(req);

    // Build audit entry
    const auditEntry: Partial<StructuredLogEntry> = {
      correlationId,
      requestId: req.requestId,
      commandId: (req as { commandId?: string }).commandId,
      method: req.method,
      path: req.path,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString(),
    };

    if (opts.includeHeaders) {
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (!opts.sensitiveHeaders.includes(key.toLowerCase())) {
          headers[key] = value as string;
        } else {
          headers[key] = '***REDACTED***';
        }
      }
      auditEntry.metadata = { headers };
    }

    if (opts.includeBody && req.body) {
      const maskedBody = maskRequestBody(req.body as Record<string, unknown>);
      auditEntry.metadata = {
        ...(auditEntry.metadata as object),
        body: maskedBody,
      };
    }

    // Log audit entry
    logInfo('Audit trail entry created', auditEntry);

    next();
  };
}

// ============================================================================
// Child Loggers (for different components)
// ============================================================================

/**
 * Create a child logger with pre-set context
 */
export function createChildLogger(
  parentContext: Partial<StructuredLogEntry>
): (level: LogLevel, message: string, context?: Partial<StructuredLogEntry>) => void {
  return function (level: LogLevel, message: string, context?: Partial<StructuredLogEntry>): void {
    const mergedContext = { ...parentContext, ...context };

    switch (level) {
      case LogLevel.DEBUG:
        logDebug(message, mergedContext);
        break;
      case LogLevel.INFO:
        logInfo(message, mergedContext);
        break;
      case LogLevel.WARN:
        logWarn(message, mergedContext);
        break;
      case LogLevel.ERROR:
        logError(message, mergedContext);
        break;
    }
  };
}

/**
 * Create a command logger
 */
export function createCommandLogger(commandId: string, correlationId: string) {
  return {
    debug: function (message: string, context?: Partial<StructuredLogEntry>): void {
      logDebug(message, { commandId, correlationId, ...context });
    },
    info: function (message: string, context?: Partial<StructuredLogEntry>): void {
      logInfo(message, { commandId, correlationId, ...context });
    },
    warn: function (message: string, context?: Partial<StructuredLogEntry>): void {
      logWarn(message, { commandId, correlationId, ...context });
    },
    error: function (message: string, context?: Partial<StructuredLogEntry>): void {
      logError(message, { commandId, correlationId, ...context });
    },
  };
}

// ============================================================================
// Export
// ============================================================================

export default {
  requestLogging,
  responseLogging,
  logging,
  auditTrail,
  createChildLogger,
  createCommandLogger,
  generateCorrelationId,
  getCorrelationId,
  maskRequestBody,
  maskObject,
  logDebug,
  logInfo,
  logWarn,
  logError,
  logRequest,
  logResponse,
  logErrorException,
  LogLevel,
};
