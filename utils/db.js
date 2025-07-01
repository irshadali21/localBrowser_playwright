const Database = require('better-sqlite3');
const path = require('path');

// Single persistent database for the app
const dbPath = path.join(__dirname, '../logs/database.db');
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

module.exports = db;
