const Database = require("better-sqlite3");
const db = new Database("queuectl.db");

// Create table if not exists
db.exec(`CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  command TEXT NOT NULL,
  state TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  max_retries INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);`);

// Add available_at column if missing (used for backoff)
try {
  // This will throw if column already exists in some SQLite versions, so we catch errors.
  db.exec(`ALTER TABLE jobs ADD COLUMN available_at TEXT;`);
} catch (err) {
  // ignore if column already exists
}

// Config table
db.exec(`CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);`);

module.exports = db;
