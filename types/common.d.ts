/**
 * Common type declarations for the project
 */

/**
 * Generic API response structure
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    timestamp: string;
    correlationId?: string;
  };
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Storage types
 */
export type StorageType = 'local' | 'bedrive' | 'wordpress';

export interface StorageConfig {
  type: StorageType;
  local?: {
    cleanupEnabled: boolean;
    cleanupIntervalHours: number;
    maxAgeHours: number;
  };
  bedrive?: {
    url: string;
    apiKey: string;
    folderId: string;
  };
  wordpress?: {
    url: string;
    username: string;
    password: string;
  };
}

/**
 * File storage result - extended with html for controller access
 */
export interface StorageResult {
  fileId: string;
  fileName: string;
  url: string;
  html?: string;
  fileSizeBytes: number;
  fileSizeKB: string;
  fileSizeMB: string;
  timestamp: number;
  storageType: StorageType;
  cloudProvider?: 'bedrive' | 'wordpress';
  shareableLink?: string;
  downloadUrl: string;
  viewUrl: string;
}

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

/**
 * Custom application error (declaration only)
 */
export class AppError extends Error {
  code: ErrorCode;
  statusCode: number;
  details?: Record<string, unknown>;
}

/**
 * Task types
 */
export type TaskStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface Task {
  id: string;
  type: string;
  target: {
    url: string;
    metadata?: Record<string, unknown>;
    lead?: Record<string, unknown>;
  };
  parser: {
    id: string;
    slug: string;
    mode: 'single' | 'batch' | 'vendor';
    definition?: Record<string, unknown>;
  };
  status: TaskStatus;
  callbackUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Job types
 */
export interface Job {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  tasks: Task[];
  createdAt: string;
  updatedAt: string;
  result?: Record<string, unknown>;
  error?: string;
}

/**
 * Configuration environment
 */
export interface EnvironmentConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  API_KEY: string;
  HEADLESS: boolean;
  STORAGE_TYPE: StorageType;
  WEBHOOK_SECRET?: string;
  LARAVEL_INTERNAL_URL?: string;
  LOCALBROWSER_SECRET?: string;
  WORKER_ID?: string;
}

/**
 * Request context
 */
export interface RequestContext {
  correlationId: string;
  ip: string;
  userAgent?: string;
  apiKey?: string;
  timestamp: Date;
}
