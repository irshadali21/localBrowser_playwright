const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Single persistent database for the app
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
const dbPath = path.join(logsDir, 'database.db');
const db = new Database(dbPath);

// Create error_logs table if it doesn't exist
db.prepare(`
  CREATE TABLE IF NOT EXISTS error_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    message TEXT,
    stack TEXT,
    route TEXT,
    input TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// Track browser pages
db.prepare(`
  CREATE TABLE IF NOT EXISTS active_pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_used TEXT DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// Track browser automation tasks (Phase 2)
db.prepare(`
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
`).run();

// Create index for efficient task queries
db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_browser_tasks_status 
  ON browser_tasks(status, created_at)
`).run();

db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_browser_tasks_worker 
  ON browser_tasks(worker_id, status)
`).run();

module.exports = db;
