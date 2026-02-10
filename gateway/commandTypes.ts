/**
 * Gateway Command Types
 * TypeScript interfaces for the Unified API Gateway
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * Command categories for organizing commands
 */
export enum CommandCategory {
  BROWSER = 'browser',
  CHAT = 'chat',
  IAAPA = 'iaapa',
  INTERNAL = 'internal',
  JOB = 'job',
  PAGE = 'page',
  CRON = 'cron',
  CLEANUP = 'cleanup',
  ERROR = 'error',
}

/**
 * HTTP methods supported by the gateway
 */
export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
}

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * Incoming request structure to the gateway
 */
export interface GatewayRequest {
  /** Unique command identifier (e.g., 'browser.visit') */
  commandId: string;

  /** API version for forward compatibility */
  version?: string;

  /** Command payload specific to the command type */
  payload: Record<string, unknown>;

  /** Optional request metadata */
  metadata?: RequestMetadata;
}

/**
 * Request metadata for tracking and context
 */
export interface RequestMetadata {
  /** Client-provided request ID for idempotency */
  requestId?: string;

  /** Client timestamp */
  clientTimestamp?: string;

  /** Callback URL for async operations */
  callbackUrl?: string;

  /** Priority level (1-10, default 5) */
  priority?: number;

  /** Request context */
  context?: RequestContext;
}

/**
 * Request context with client information
 */
export interface RequestContext {
  /** Client IP address */
  ip?: string;

  /** User agent */
  userAgent?: string;

  /** Source platform */
  source?: string;

  /** Correlation ID for distributed tracing */
  correlationId?: string;
}

/**
 * Response structure from the gateway
 */
export interface GatewayResponse {
  /** Whether the command was successful */
  success: boolean;

  /** Response data (only if success is true) */
  data?: ResponseData;

  /** Error information (only if success is false) */
  error?: ErrorResponse;

  /** Response metadata */
  metadata?: ResponseMetadata;
}

/**
 * Response data structure
 */
export interface ResponseData {
  /** Command-specific result */
  result: unknown;

  /** Additional response info */
  info?: Record<string, unknown>;
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  /** Error code */
  code: string;

  /** Human-readable error message */
  message: string;

  /** Additional error details */
  details?: Record<string, unknown>;

  /** Correlation ID for tracking */
  correlationId?: string;
}

/**
 * Response metadata
 */
export interface ResponseMetadata {
  /** Processing time in milliseconds */
  processingTimeMs: number;

  /** Server timestamp */
  timestamp: string;

  /** Command that was executed */
  commandId: string;

  /** API version */
  version: string;
}

// ============================================================================
// Command Definition
// ============================================================================

/**
 * Command definition stored in the registry
 */
export interface CommandDefinition {
  /** Unique command identifier */
  id: string;

  /** Display name */
  name: string;

  /** Description of what the command does */
  description: string;

  /** Category the command belongs to */
  category: CommandCategory;

  /** HTTP method for direct routing */
  method: HttpMethod;

  /** Route pattern for direct routing */
  route?: string;

  /** Whether authentication is required */
  requireAuth: boolean;

  /** Payload schema for validation */
  payloadSchema?: PayloadSchema;

  /** Handler function reference */
  handler: string;

  /** Aliases for the command */
  aliases?: string[];

  /** Deprecation info */
  deprecated?: {
    deprecated: boolean;
    替代方案?: string;
    sunsetDate?: string;
  };
}

/**
 * Payload schema for validation
 */
export interface PayloadSchema {
  /** Schema type (e.g., 'zod', 'json-schema') */
  type: string;

  /** Schema definition */
  schema: Record<string, unknown>;
}

// ============================================================================
// Command Payloads - Browser
// ============================================================================

/**
 * Browser visit payload
 */
export interface BrowserVisitPayload {
  url: string;
  options?: {
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
    timeout?: number;
    returnHtml?: boolean;
    saveToFile?: boolean;
    handleCloudflare?: boolean;
    useProgressiveRetry?: boolean;
  };
}

/**
 * Browser execute payload
 */
export interface BrowserExecutePayload {
  code: string;
  timeout?: number;
}

/**
 * Browser screenshot payload
 */
export interface BrowserScreenshotPayload {
  pageId?: string;
  options?: {
    fullPage?: boolean;
    format?: 'png' | 'jpeg' | 'webp';
    quality?: number;
    saveToFile?: boolean;
  };
}

/**
 * Browser navigate payload
 */
export interface BrowserNavigatePayload {
  pageId?: string;
  url: string;
  options?: BrowserVisitPayload['options'];
}

/**
 * Browser evaluate payload
 */
export interface BrowserEvaluatePayload {
  expression: string;
  pageId?: string;
  timeout?: number;
}

// ============================================================================
// Command Payloads - Chat
// ============================================================================

/**
 * Chat message payload
 */
export interface ChatMessagePayload {
  prompt: string;
  sessionId?: string;
  options?: {
    stream?: boolean;
    temperature?: number;
    maxTokens?: number;
    model?: string;
  };
}

/**
 * Chat conversation payload
 */
export interface ChatConversationPayload {
  sessionId: string;
  options?: {
    includeMetadata?: boolean;
    limit?: number;
  };
}

/**
 * Chat history payload
 */
export interface ChatHistoryPayload {
  sessionId?: string;
  options?: {
    limit?: number;
    offset?: number;
  };
}

/**
 * Chat clear payload
 */
export interface ChatClearPayload {
  sessionId?: string;
  all?: boolean;
}

// ============================================================================
// Command Payloads - IAAPA
// ============================================================================

/**
 * IAAPA search payload
 */
export interface IaapaSearchPayload {
  query: string;
  filters?: Record<string, unknown>;
  options?: {
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
}

/**
 * IAAPA filter payload
 */
export interface IaapaFilterPayload {
  filters: Record<string, unknown>;
  options?: {
    limit?: number;
    offset?: number;
  };
}

/**
 * IAAPA export payload
 */
export interface IaapaExportPayload {
  format: 'csv' | 'json' | 'xlsx';
  filters?: Record<string, unknown>;
  filename?: string;
}

/**
 * IAAPA import payload
 */
export interface IaapaImportPayload {
  source: string;
  format: 'csv' | 'json';
  options?: Record<string, unknown>;
}

// ============================================================================
// Command Payloads - Internal
// ============================================================================

/**
 * Internal health payload
 */
export interface InternalHealthPayload {
  checks?: string[];
}

/**
 * Internal metrics payload
 */
export interface InternalMetricsPayload {
  metrics?: string[];
  timeframe?: {
    start?: string;
    end?: string;
  };
}

/**
 * Internal config payload
 */
export interface InternalConfigPayload {
  keys?: string[];
}

/**
 * Internal worker payload
 */
export interface InternalWorkerPayload {
  action: 'status' | 'restart' | 'pause' | 'resume';
  workerId?: string;
}

// ============================================================================
// Command Payloads - Job
// ============================================================================

/**
 * Job create payload
 */
export interface JobCreatePayload {
  jobId?: string;
  target: {
    url: string;
    metadata?: Record<string, unknown>;
    lead?: Record<string, unknown>;
  };
  parser: {
    slug: string;
    mode: 'single' | 'batch' | 'vendor';
    definition?: Record<string, unknown>;
  };
  callbackUrl?: string;
  priority?: number;
}

/**
 * Job status payload
 */
export interface JobStatusPayload {
  jobId: string;
}

/**
 * Job cancel payload
 */
export interface JobCancelPayload {
  jobId: string;
  reason?: string;
}

/**
 * Job list payload
 */
export interface JobListPayload {
  options?: {
    status?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
}

// ============================================================================
// Command Payloads - Page
// ============================================================================

/**
 * Page create payload
 */
export interface PageCreatePayload {
  type: 'browser' | 'chat' | 'scraper';
  options?: Record<string, unknown>;
}

/**
 * Page read payload
 */
export interface PageReadPayload {
  pageId: string;
}

/**
 * Page update payload
 */
export interface PageUpdatePayload {
  pageId: string;
  updates: Record<string, unknown>;
}

/**
 * Page delete payload
 */
export interface PageDeletePayload {
  pageId: string;
  force?: boolean;
}

// ============================================================================
// Command Payloads - Cron
// ============================================================================

/**
 * Cron schedule payload
 */
export interface CronSchedulePayload {
  cronExpression: string;
  commandId: string;
  payload?: Record<string, unknown>;
  options?: {
    enabled?: boolean;
    timezone?: string;
    startDate?: string;
    endDate?: string;
  };
}

/**
 * Cron unschedule payload
 */
export interface CronUnschedulePayload {
  jobId: string;
}

/**
 * Cron list payload
 */
export interface CronListPayload {
  options?: {
    enabled?: boolean;
    category?: string;
  };
}

/**
 * Cron trigger payload
 */
export interface CronTriggerPayload {
  jobId: string;
  payload?: Record<string, unknown>;
}

// ============================================================================
// Command Payloads - Cleanup
// ============================================================================

/**
 * Cleanup logs payload
 */
export interface CleanupLogsPayload {
  maxAge?: number; // Days
  force?: boolean;
}

/**
 * Cleanup cache payload
 */
export interface CleanupCachePayload {
  pattern?: string;
  maxAge?: number;
  force?: boolean;
}

/**
 * Cleanup temp payload
 */
export interface CleanupTempPayload {
  pattern?: string;
  maxAge?: number;
  force?: boolean;
}

/**
 * Cleanup sessions payload
 */
export interface CleanupSessionsPayload {
  maxAge?: number;
  force?: boolean;
}

// ============================================================================
// Command Payloads - Error
// ============================================================================

/**
 * Error report payload
 */
export interface ErrorReportPayload {
  type: string;
  message: string;
  stack?: string;
  route?: string;
  input?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

/**
 * Error status payload
 */
export interface ErrorStatusPayload {
  errorId?: string;
  timeframe?: {
    start?: string;
    end?: string;
  };
}

/**
 * Error history payload
 */
export interface ErrorHistoryPayload {
  options?: {
    limit?: number;
    offset?: number;
    errorType?: string;
  };
}

/**
 * Error resolve payload
 */
export interface ErrorResolvePayload {
  errorId: string;
  resolution: string;
  notes?: string;
}

// ============================================================================
// Union Types
// ============================================================================

/**
 * Union of all browser payloads
 */
export type BrowserPayload =
  | BrowserVisitPayload
  | BrowserExecutePayload
  | BrowserScreenshotPayload
  | BrowserNavigatePayload
  | BrowserEvaluatePayload;

/**
 * Union of all chat payloads
 */
export type ChatPayload =
  | ChatMessagePayload
  | ChatConversationPayload
  | ChatHistoryPayload
  | ChatClearPayload;

/**
 * Union of all IAAPA payloads
 */
export type IaapaPayload =
  | IaapaSearchPayload
  | IaapaFilterPayload
  | IaapaExportPayload
  | IaapaImportPayload;

/**
 * Union of all internal payloads
 */
export type InternalPayload =
  | InternalHealthPayload
  | InternalMetricsPayload
  | InternalConfigPayload
  | InternalWorkerPayload;

/**
 * Union of all job payloads
 */
export type JobPayload = JobCreatePayload | JobStatusPayload | JobCancelPayload | JobListPayload;

/**
 * Union of all page payloads
 */
export type PagePayload =
  | PageCreatePayload
  | PageReadPayload
  | PageUpdatePayload
  | PageDeletePayload;

/**
 * Union of all cron payloads
 */
export type CronPayload =
  | CronSchedulePayload
  | CronUnschedulePayload
  | CronListPayload
  | CronTriggerPayload;

/**
 * Union of all cleanup payloads
 */
export type CleanupPayload =
  | CleanupLogsPayload
  | CleanupCachePayload
  | CleanupTempPayload
  | CleanupSessionsPayload;

/**
 * Union of all error payloads
 */
export type ErrorPayload =
  | ErrorReportPayload
  | ErrorStatusPayload
  | ErrorHistoryPayload
  | ErrorResolvePayload;
