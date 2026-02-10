/**
 * Gateway Error Handler Middleware
 * Extends existing errorHandler.ts with gateway-specific error codes, unknown command detection, and correlation ID inclusion
 */

import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  TimeoutError,
  NetworkError,
  AppError,
} from '../types/errors';
import { commandRegistry } from '../gateway/commandRegistry';
import { logErrorException, getCorrelationId, LogLevel } from './gatewayLogging';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Gateway-specific error codes
 */
export enum GatewayErrorCode {
  // Authentication & Authorization
  MISSING_API_KEY = 'ERR_MISSING_API_KEY',
  INVALID_API_KEY = 'ERR_INVALID_API_KEY',
  API_KEY_INACTIVE = 'ERR_API_KEY_INACTIVE',
  API_KEY_EXPIRED = 'ERR_API_KEY_EXPIRED',
  INSUFFICIENT_SCOPES = 'ERR_INSUFFICIENT_SCOPES',
  MISSING_HMAC_SIGNATURE = 'ERR_MISSING_HMAC_SIGNATURE',
  INVALID_HMAC_SIGNATURE = 'ERR_INVALID_HMAC_SIGNATURE',
  HMAC_TIMESTAMP_EXPIRED = 'ERR_HMAC_TIMESTAMP_EXPIRED',

  // Validation
  INVALID_REQUEST_STRUCTURE = 'ERR_INVALID_REQUEST_STRUCTURE',
  MISSING_COMMAND_ID = 'ERR_MISSING_COMMAND_ID',
  INVALID_PAYLOAD = 'ERR_INVALID_PAYLOAD',
  UNKNOWN_COMMAND = 'ERR_UNKNOWN_COMMAND',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'ERR_RATE_LIMIT_EXCEEDED',
  COMMAND_RATE_LIMIT_EXCEEDED = 'ERR_COMMAND_RATE_LIMIT_EXCEEDED',

  // Execution
  COMMAND_NOT_FOUND = 'ERR_COMMAND_NOT_FOUND',
  HANDLER_NOT_FOUND = 'ERR_HANDLER_NOT_FOUND',
  HANDLER_EXECUTION_FAILED = 'ERR_HANDLER_EXECUTION_FAILED',
  TIMEOUT = 'ERR_TIMEOUT',

  // General
  INTERNAL_ERROR = 'ERR_INTERNAL',
  SERVICE_UNAVAILABLE = 'ERR_SERVICE_UNAVAILABLE',
}

/**
 * Error response format
 */
export interface GatewayErrorResponse {
  success: boolean;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    correlationId?: string;
    suggestions?: string[];
  };
  metadata?: {
    processingTimeMs: number;
    timestamp: string;
    version: string;
  };
}

/**
 * Extended Express Request with error context
 */
export interface ErrorHandledRequest extends Request {
  correlationId?: string;
  commandId?: string;
  startTime?: number;
}

// ============================================================================
// Error Mapping
// ============================================================================

/**
 * Map standard errors to gateway error codes
 */
export function mapErrorToCode(error: Error): GatewayErrorCode {
  // Check if it's already a gateway error code
  if (error instanceof AppError) {
    const codeMap: Record<string, GatewayErrorCode> = {
      AUTHENTICATION_ERROR: GatewayErrorCode.INVALID_API_KEY,
      AUTHORIZATION_ERROR: GatewayErrorCode.INSUFFICIENT_SCOPES,
      VALIDATION_ERROR: GatewayErrorCode.INVALID_PAYLOAD,
      NOT_FOUND: GatewayErrorCode.COMMAND_NOT_FOUND,
      TIMEOUT: GatewayErrorCode.TIMEOUT,
      NETWORK_ERROR: GatewayErrorCode.SERVICE_UNAVAILABLE,
    };
    return codeMap[error.code] || GatewayErrorCode.INTERNAL_ERROR;
  }

  // Map by error name/message
  if (error instanceof ValidationError) {
    return GatewayErrorCode.INVALID_PAYLOAD;
  }

  if (error instanceof AuthenticationError) {
    return GatewayErrorCode.INVALID_API_KEY;
  }

  if (error instanceof AuthorizationError) {
    return GatewayErrorCode.INSUFFICIENT_SCOPES;
  }

  if (error instanceof NotFoundError) {
    return GatewayErrorCode.COMMAND_NOT_FOUND;
  }

  if (error instanceof TimeoutError) {
    return GatewayErrorCode.TIMEOUT;
  }

  if (error instanceof NetworkError) {
    return GatewayErrorCode.SERVICE_UNAVAILABLE;
  }

  // Check message patterns
  const message = error.message.toLowerCase();

  if (message.includes('api key')) {
    if (message.includes('missing')) {
      return GatewayErrorCode.MISSING_API_KEY;
    }
    if (message.includes('invalid')) {
      return GatewayErrorCode.INVALID_API_KEY;
    }
    if (message.includes('expired')) {
      return GatewayErrorCode.API_KEY_EXPIRED;
    }
  }

  if (message.includes('hmac') || message.includes('signature')) {
    if (message.includes('missing')) {
      return GatewayErrorCode.MISSING_HMAC_SIGNATURE;
    }
    if (message.includes('invalid') || message.includes('expired')) {
      return GatewayErrorCode.INVALID_HMAC_SIGNATURE;
    }
  }

  if (
    message.includes('unknown command') ||
    message.includes('not found') ||
    message.includes('does not exist')
  ) {
    return GatewayErrorCode.UNKNOWN_COMMAND;
  }

  if (message.includes('rate limit')) {
    return GatewayErrorCode.RATE_LIMIT_EXCEEDED;
  }

  if (message.includes('timeout')) {
    return GatewayErrorCode.TIMEOUT;
  }

  return GatewayErrorCode.INTERNAL_ERROR;
}

// ============================================================================
// Suggestion Helper
// ============================================================================

/**
 * Find similar commands for unknown command errors
 */
function findCommandSuggestions(commandId: string): string[] {
  const allCommands = commandRegistry.getAll().map(c => c.id);
  const threshold = 3;
  const maxSuggestions = 3;

  const suggestions = allCommands
    .map(cmd => ({
      id: cmd,
      distance: levenshteinDistance(commandId.toLowerCase(), cmd.toLowerCase()),
    }))
    .filter(s => s.distance <= threshold && s.distance > 0)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxSuggestions)
    .map(s => s.id);

  return suggestions;
}

/**
 * Calculate Levenshtein distance
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// ============================================================================
// Error Response Formatting
// ============================================================================

/**
 * Format error response
 */
export function formatErrorResponse(
  error: Error,
  correlationId: string,
  commandId: string | undefined,
  processingTimeMs: number
): GatewayErrorResponse {
  const code = mapErrorToCode(error);

  const response: GatewayErrorResponse = {
    success: false,
    error: {
      code,
      message: error.message || 'An unexpected error occurred',
      correlationId,
    },
    metadata: {
      processingTimeMs,
      timestamp: new Date().toISOString(),
      version: 'v1',
    },
  };

  // Add suggestions for unknown commands
  if (code === GatewayErrorCode.UNKNOWN_COMMAND && commandId) {
    const suggestions = findCommandSuggestions(commandId);
    if (suggestions.length > 0) {
      response.error.suggestions = suggestions;
      response.error.message = `Unknown command: ${commandId}. Did you mean: ${suggestions.join(', ')}?`;
    }
  }

  // Add error details if available
  const appError = error as AppError & { details?: Record<string, unknown> };
  if (appError.details) {
    response.error.details = appError.details;
  }

  return response;
}

/**
 * Get HTTP status code from error code
 */
export function getHttpStatusCode(errorCode: GatewayErrorCode): number {
  const statusMap: Record<string, number> = {
    // 4xx Client Errors
    [GatewayErrorCode.MISSING_API_KEY]: 401,
    [GatewayErrorCode.INVALID_API_KEY]: 401,
    [GatewayErrorCode.API_KEY_INACTIVE]: 403,
    [GatewayErrorCode.API_KEY_EXPIRED]: 403,
    [GatewayErrorCode.INSUFFICIENT_SCOPES]: 403,
    [GatewayErrorCode.MISSING_HMAC_SIGNATURE]: 401,
    [GatewayErrorCode.INVALID_HMAC_SIGNATURE]: 401,
    [GatewayErrorCode.HMAC_TIMESTAMP_EXPIRED]: 401,
    [GatewayErrorCode.INVALID_REQUEST_STRUCTURE]: 400,
    [GatewayErrorCode.MISSING_COMMAND_ID]: 400,
    [GatewayErrorCode.INVALID_PAYLOAD]: 400,
    [GatewayErrorCode.UNKNOWN_COMMAND]: 400,
    [GatewayErrorCode.RATE_LIMIT_EXCEEDED]: 429,
    [GatewayErrorCode.COMMAND_RATE_LIMIT_EXCEEDED]: 429,
    [GatewayErrorCode.COMMAND_NOT_FOUND]: 404,
    [GatewayErrorCode.HANDLER_NOT_FOUND]: 500,
    [GatewayErrorCode.HANDLER_EXECUTION_FAILED]: 500,
    // 5xx Server Errors
    [GatewayErrorCode.TIMEOUT]: 504,
    [GatewayErrorCode.INTERNAL_ERROR]: 500,
    [GatewayErrorCode.SERVICE_UNAVAILABLE]: 503,
  };

  return statusMap[errorCode] || 500;
}

// ============================================================================
// Error Handler Middleware
// ============================================================================

/**
 * Gateway Error Handler Middleware
 *
 * Extends the existing errorHandler.ts with:
 * - Gateway-specific error codes
 * - Unknown command detection with suggestions
 * - Correlation ID inclusion in errors
 * - Structured error response formatting
 */
export const gatewayErrorHandler: ErrorRequestHandler = (
  err: Error,
  req: ErrorHandledRequest,
  res: Response,
  _next: NextFunction
): void => {
  const startTime = req.startTime || Date.now();
  const processingTimeMs = Date.now() - startTime;

  // Get or generate correlation ID
  const correlationId = req.correlationId || getCorrelationId(req);
  const commandId = req.commandId;

  // Determine error source
  const isOperational = err instanceof AppError || err instanceof ValidationError;

  // Log the error
  if (isOperational) {
    logErrorException(err, req, { level: LogLevel.WARN });
  } else {
    logErrorException(err, req, { level: LogLevel.ERROR });
  }

  // Format the error response
  const errorResponse = formatErrorResponse(err, correlationId, commandId, processingTimeMs);
  const statusCode = getHttpStatusCode(mapErrorToCode(err));

  // Set response headers
  res.set('X-Correlation-ID', correlationId);
  res.set('X-Error-Code', errorResponse.error.code);

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found Handler
 */
export function notFoundHandler(req: Request, res: Response, _next: NextFunction): void {
  const correlationId = getCorrelationId(req as ErrorHandledRequest);

  res.set('X-Correlation-ID', correlationId);

  res.status(404).json({
    success: false,
    error: {
      code: GatewayErrorCode.COMMAND_NOT_FOUND,
      message: `Route not found: ${req.method} ${req.path}`,
      correlationId,
    },
    metadata: {
      processingTimeMs: 0,
      timestamp: new Date().toISOString(),
      version: 'v1',
    },
  });
}

/**
 * Async Handler Wrapper
 *
 * Wraps async route handlers to catch errors
 */
export function asyncHandler<T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<void>
): (req: T, res: Response, next: NextFunction) => void {
  return (req: T, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create error with context
 */
export class GatewayError extends Error {
  code: GatewayErrorCode;
  details?: Record<string, unknown>;
  correlationId?: string;

  constructor(
    message: string,
    code: GatewayErrorCode,
    details?: Record<string, unknown>,
    correlationId?: string
  ) {
    super(message);
    this.name = 'GatewayError';
    this.code = code;
    this.details = details;
    this.correlationId = correlationId;
  }
}

/**
 * Create unknown command error
 */
export function createUnknownCommandError(commandId: string, correlationId: string): GatewayError {
  const suggestions = findCommandSuggestions(commandId);
  const message =
    suggestions.length > 0
      ? `Unknown command: ${commandId}. Did you mean: ${suggestions.join(', ')}?`
      : `Unknown command: ${commandId}`;

  return new GatewayError(
    message,
    GatewayErrorCode.UNKNOWN_COMMAND,
    { commandId, suggestions },
    correlationId
  );
}

// ============================================================================
// Export
// ============================================================================

export default {
  gatewayErrorHandler,
  notFoundHandler,
  asyncHandler,
  formatErrorResponse,
  mapErrorToCode,
  getHttpStatusCode,
  GatewayError,
  createUnknownCommandError,
  GatewayErrorCode,
};
