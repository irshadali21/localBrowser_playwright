/**
 * Common runtime types and values
 */

// Re-export all types from common.d.ts for runtime access
export type {
  ApiResponse,
  PaginationOptions,
  PaginatedResponse,
  StorageType,
  StorageConfig,
  StorageResult,
  Task,
  TaskStatus,
  Job,
  EnvironmentConfig,
  RequestContext,
} from './common.d';

/**
 * Error codes
 */
export enum ErrorCode {
  VALIDATION_ERROR = 'ERR_VALIDATION',
  AUTHENTICATION_ERROR = 'ERR_AUTH',
  AUTHORIZATION_ERROR = 'ERR_FORBIDDEN',
  NOT_FOUND = 'ERR_NOT_FOUND',
  INTERNAL_ERROR = 'ERR_INTERNAL',
  TIMEOUT = 'ERR_TIMEOUT',
  NETWORK_ERROR = 'ERR_NETWORK',
  CONFLICT = 'ERR_CONFLICT'
}
