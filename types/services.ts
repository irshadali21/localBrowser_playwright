// types/services.ts
// Common service type definitions for TypeScript migration

/**
 * Logger interface for service logging
 */
export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug?(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Task status discriminated union
 */
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Task type definitions
 */
export type TaskType = 'website_html' | 'lighthouse_html';

/**
 * Base task payload interface
 */
export interface TaskPayload {
  waitUntil?: 'domcontentloaded' | 'networkidle' | 'load';
  timeout?: number;
  handleCloudflare?: boolean;
  useProgressiveRetry?: boolean;
  [key: string]: unknown;
}

/**
 * Complete Task interface
 */
export interface Task {
  id: string;
  type: TaskType;
  url: string;
  payload?: TaskPayload | null;
  status?: TaskStatus;
  result?: unknown;
  error?: string | null;
  worker_id?: string | null;
  processing_by?: string | null;
  created_at?: string;
  started_at?: string | null;
  completed_at?: string | null;
  duration_ms?: number | null;
}

/**
 * Task creation input (without auto-generated fields)
 */
export interface TaskInput {
  id?: string;
  type: TaskType;
  url: string;
  payload?: TaskPayload;
}

/**
 * Task statistics interface
 */
export interface TaskStatistics {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

/**
 * Task execution result interface
 */
export interface TaskExecutionResult {
  task_id: string;
  type: TaskType;
  success: boolean;
  result?: unknown;
  error?: string;
  executed_at: string;
  duration_ms: number;
}

/**
 * Task validation result interface
 */
export interface TaskValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Configuration interfaces
 */
export interface TaskQueueServiceConfig {
  logger?: Logger;
  maxConcurrentTasks?: number;
}

export interface TaskExecutorConfig {
  browserHelper: BrowserHelper;
}

export interface TaskProcessorConfig {
  taskQueueService?: TaskQueueService;
  taskExecutor?: TaskExecutor;
  resultSubmitter?: ResultSubmitter;
  logger?: Logger;
  intervalMs?: number;
  maxConcurrent?: number;
}

export interface ResultSubmitterConfig {
  laravelUrl: string;
  secret: string;
  workerId?: string;
  maxRetries?: number;
  retryDelayMs?: number;
  requestTimeout?: number;
}

export interface TaskMaintenanceWorkerConfig {
  taskQueueService?: TaskQueueService;
  logger?: Logger;
  stuckTaskIntervalMs?: number;
  stuckTaskThresholdMinutes?: number;
  cleanupIntervalMs?: number;
  cleanupOlderThanDays?: number;
}

export interface JobQueueConfig {
  logger?: Logger;
  maxConcurrent?: number;
}

/**
 * Processor status interface
 */
export interface TaskProcessorStatus {
  running: boolean;
  activeTasks: number;
  maxConcurrent: number;
  intervalMs: number;
}

/**
 * Signed payload for Laravel submission
 */
export interface SignedPayload {
  task_id: string;
  type: string;
  status: 'completed' | 'failed';
  executed_at: string;
  duration_ms: number;
  worker_id: string;
  processing_by: string;
  result?: unknown;
  error?: string;
}

/**
 * Service interface placeholders (will be imported after migration)
 */
// These are forward declarations - actual implementations will be imported
export interface TaskQueueService {
  enqueueTask(task: TaskInput): Promise<string>;
  enqueueBatch(tasks: TaskInput[]): Promise<string[]>;
  getPendingTasks(limit?: number): Promise<Task[]>;
  getTask(taskId: string): Promise<Task | null>;
  updateTaskStatus(taskId: string, status: TaskStatus, metadata?: Partial<Task>): Promise<void>;
  getStatistics(): Promise<TaskStatistics>;
  cleanupOldTasks(olderThanDays?: number): Promise<number>;
  resetStuckTasks(stuckAfterMinutes?: number): Promise<number>;
}

export interface TaskExecutor {
  execute(task: Task): Promise<TaskExecutionResult>;
}

export interface ResultSubmitter {
  submit(result: TaskExecutionResult): Promise<unknown>;
}

export interface BrowserHelper {
  visitUrl(url: string, options?: Record<string, unknown>): Promise<Record<string, unknown>>;
  scrapeProduct(url: string, vendorKey: string): Promise<unknown>;
  runScript(script: string, context: Record<string, unknown>): Promise<unknown>;
  closeBrowser(): Promise<void>;
}

export { Logger as default };
