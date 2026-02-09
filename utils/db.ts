import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Single persistent database for the app
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
const dbPath = path.join(logsDir, 'database.db');
// Using 'any' type to work around better-sqlite3 type export issues
const db = new Database(dbPath) as any;

// Type definitions for database tables
export interface ErrorLog {
  id?: number;
  type: string;
  message: string;
  stack?: string;
  route?: string;
  input?: string;
  created_at?: string;
}

export interface ActivePage {
  id?: number;
  type: string;
  status?: string;
  created_at?: string;
  last_used?: string;
}

export interface BrowserTask {
  id: string;
  type: string;
  url: string;
  payload?: string;
  status?: string;
  result?: string;
  error?: string;
  worker_id?: string;
  processing_by?: string;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
}

// Create error_logs table if it doesn't exist
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS error_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    message TEXT,
    stack TEXT,
    route TEXT,
    input TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`
).run();

// Track browser pages
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS active_pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_used TEXT DEFAULT CURRENT_TIMESTAMP
  )
`
).run();

// Track browser automation tasks
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS browser_tasks (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    url TEXT NOT NULL,
    payload TEXT,
    status TEXT DEFAULT 'pending',
    result TEXT,
    error TEXT,
    worker_id TEXT,
    processing_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    started_at TEXT,
    completed_at TEXT,
    duration_ms INTEGER
  )
`
).run();

// Create index for efficient task queries
db.prepare(
  `
  CREATE INDEX IF NOT EXISTS idx_browser_tasks_status 
  ON browser_tasks(status, created_at)
`
).run();

db.prepare(
  `
  CREATE INDEX IF NOT EXISTS idx_browser_tasks_worker 
  ON browser_tasks(worker_id, status)
`
).run();

// Database operation functions with type safety

/**
 * Insert an error log entry
 */
export function logError(error: Omit<ErrorLog, 'id' | 'created_at'>): void {
  db.prepare(
    `
    INSERT INTO error_logs (type, message, stack, route, input)
    VALUES (@type, @message, @stack, @route, @input)
  `
  ).run(error);
}

/**
 * Get recent error logs
 */
export function getRecentErrors(limit: number = 10): ErrorLog[] {
  return db
    .prepare(
      `
    SELECT * FROM error_logs ORDER BY created_at DESC LIMIT ?
  `
    )
    .all(limit) as ErrorLog[];
}

/**
 * Register a new active page
 */
export function registerPage(type: string): number {
  const result = db
    .prepare(
      `
    INSERT INTO active_pages (type) VALUES (?)
  `
    )
    .run(type);
  return result.lastInsertRowid as number;
}

/**
 * Update page last_used timestamp
 */
export function touchPage(id: number): void {
  db.prepare(
    `
    UPDATE active_pages SET last_used = CURRENT_TIMESTAMP WHERE id = ?
  `
  ).run(id);
}

/**
 * Close a page (mark as inactive)
 */
export function closePage(id: number): void {
  db.prepare(
    `
    UPDATE active_pages SET status = 'closed' WHERE id = ?
  `
  ).run(id);
}

/**
 * Get all active pages
 */
export function getActivePages(): ActivePage[] {
  return db
    .prepare(
      `
    SELECT * FROM active_pages WHERE status = 'active'
  `
    )
    .all() as ActivePage[];
}

/**
 * Get count of active pages by type
 */
export function getActivePageCountByType(type: string): number {
  const result = db
    .prepare(
      `
    SELECT COUNT(*) as count FROM active_pages WHERE type = ? AND status = 'active'
  `
    )
    .get(type) as { count: number };
  return result.count;
}

/**
 * Close oldest idle pages exceeding threshold
 */
export function closeIdlePages(keepCount: number): number {
  const activeCount = db
    .prepare(
      `
    SELECT COUNT(*) as count FROM active_pages WHERE status = 'active'
  `
    )
    .get() as { count: number };

  if (activeCount.count <= keepCount) {
    return 0;
  }

  const result = db
    .prepare(
      `
    UPDATE active_pages 
    SET status = 'closed' 
    WHERE id IN (
      SELECT id FROM active_pages 
      WHERE status = 'active' 
      ORDER BY last_used ASC 
      LIMIT ?
    )
  `
    )
    .run(activeCount.count - keepCount);

  return result.changes;
}

/**
 * Insert a new browser task
 */
export function insertTask(task: BrowserTask): void {
  db.prepare(
    `
    INSERT INTO browser_tasks (id, type, url, payload, status)
    VALUES (@id, @type, @url, @payload, @status)
  `
  ).run(task);
}

/**
 * Get pending tasks
 */
export function getPendingTasks(limit: number = 10): BrowserTask[] {
  return db
    .prepare(
      `
    SELECT * FROM browser_tasks 
    WHERE status = 'pending' 
    ORDER BY created_at ASC 
    LIMIT ?
  `
    )
    .all(limit) as BrowserTask[];
}

/**
 * Get task by ID
 */
export function getTaskById(id: string): BrowserTask | undefined {
  return db
    .prepare(
      `
    SELECT * FROM browser_tasks WHERE id = ?
  `
    )
    .get(id) as BrowserTask | undefined;
}

/**
 * Update task status
 */
export function updateTaskStatus(
  id: string,
  status: string,
  additionalFields?: Partial<BrowserTask>
): void {
  let query = `UPDATE browser_tasks SET status = ?`;
  const params: (string | number | undefined)[] = [status];

  if (additionalFields) {
    if (additionalFields.worker_id !== undefined) {
      query += `, worker_id = ?`;
      params.push(additionalFields.worker_id);
    }
    if (additionalFields.processing_by !== undefined) {
      query += `, processing_by = ?`;
      params.push(additionalFields.processing_by);
    }
    if (additionalFields.started_at !== undefined) {
      query += `, started_at = ?`;
      params.push(additionalFields.started_at);
    }
    if (additionalFields.completed_at !== undefined) {
      query += `, completed_at = ?`;
      params.push(additionalFields.completed_at);
    }
    if (additionalFields.duration_ms !== undefined) {
      query += `, duration_ms = ?`;
      params.push(additionalFields.duration_ms);
    }
    if (additionalFields.result !== undefined) {
      query += `, result = ?`;
      params.push(additionalFields.result);
    }
    if (additionalFields.error !== undefined) {
      query += `, error = ?`;
      params.push(additionalFields.error);
    }
  }

  query += ` WHERE id = ?`;
  params.push(id);

  db.prepare(query).run(...params);
}

/**
 * Get task statistics
 */
export function getTaskStats(): {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
} {
  const total = db.prepare(`SELECT COUNT(*) as count FROM browser_tasks`).get() as {
    count: number;
  };
  const pending = db
    .prepare(`SELECT COUNT(*) as count FROM browser_tasks WHERE status = 'pending'`)
    .get() as { count: number };
  const processing = db
    .prepare(`SELECT COUNT(*) as count FROM browser_tasks WHERE status = 'processing'`)
    .get() as { count: number };
  const completed = db
    .prepare(`SELECT COUNT(*) as count FROM browser_tasks WHERE status = 'completed'`)
    .get() as { count: number };
  const failed = db
    .prepare(`SELECT COUNT(*) as count FROM browser_tasks WHERE status = 'failed'`)
    .get() as { count: number };

  return {
    total: total.count,
    pending: pending.count,
    processing: processing.count,
    completed: completed.count,
    failed: failed.count,
  };
}

/**
 * Reset stuck tasks (processing for too long)
 */
export function resetStuckTasks(thresholdMinutes: number = 30): number {
  const threshold = new Date(Date.now() - thresholdMinutes * 60 * 1000).toISOString();
  const result = db
    .prepare(
      `
    UPDATE browser_tasks 
    SET status = 'pending', worker_id = NULL, processing_by = NULL
    WHERE status = 'processing' AND started_at < ?
  `
    )
    .run(threshold);
  return result.changes;
}

/**
 * Delete old completed/failed tasks
 */
export function cleanupOldTasks(daysOld: number = 7): number {
  const threshold = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();
  const result = db
    .prepare(
      `
    DELETE FROM browser_tasks 
    WHERE status IN ('completed', 'failed') AND completed_at < ?
  `
    )
    .run(threshold);
  return result.changes;
}

// Export database instance for raw queries if needed
// Using type assertion to work around better-sqlite3 export issue
export { db as any };
export default db as any;
