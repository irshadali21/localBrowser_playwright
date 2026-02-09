/**
 * Custom error classes for the browser automation project
 */

import { BrowserErrorCode } from './browser';
import { ErrorCode } from './common';

/**
 * Custom browser error class
 */
export class BrowserError extends Error {
  code: BrowserErrorCode;
  context?: Record<string, unknown>;

  constructor(
    message: string,
    code: BrowserErrorCode,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'BrowserError';
    this.code = code;
    this.context = context;
  }
}

/**
 * Custom application error class
 */
export class AppError extends Error {
  code: ErrorCode;
  statusCode: number;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Validation error class
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    details?: Record<string, unknown>
  ) {
    super(
      message,
      ErrorCode.VALIDATION_ERROR,
      400,
      details
    );
    this.name = 'ValidationError';
  }
}

/**
 * Authentication error class
 */
export class AuthenticationError extends AppError {
  constructor(
    message: string = 'Authentication failed',
    details?: Record<string, unknown>
  ) {
    super(message, ErrorCode.AUTHENTICATION_ERROR, 401, details);
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization error class
 */
export class AuthorizationError extends AppError {
  constructor(
    message: string = 'Access denied',
    details?: Record<string, unknown>
  ) {
    super(message, ErrorCode.AUTHORIZATION_ERROR, 403, details);
    this.name = 'AuthorizationError';
  }
}

/**
 * Not found error class
 */
export class NotFoundError extends AppError {
  constructor(
    message: string = 'Resource not found',
    details?: Record<string, unknown>
  ) {
    super(message, ErrorCode.NOT_FOUND, 404, details);
    this.name = 'NotFoundError';
  }
}

/**
 * Timeout error class
 */
export class TimeoutError extends AppError {
  constructor(
    message: string = 'Operation timed out',
    details?: Record<string, unknown>
  ) {
    super(message, ErrorCode.TIMEOUT, 408, details);
    this.name = 'TimeoutError';
  }
}

/**
 * Network error class
 */
export class NetworkError extends AppError {
  constructor(
    message: string = 'Network error occurred',
    details?: Record<string, unknown>
  ) {
    super(message, ErrorCode.NETWORK_ERROR, 502, details);
    this.name = 'NetworkError';
  }
}
