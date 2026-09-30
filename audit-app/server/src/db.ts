import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { config } from './config.js';

let db: SqlJsDatabase;

// Thin wrapper that gives sql.js a better-sqlite3-like API so route handlers
// read naturally: db.prepare(sql).get/all/run and db.run(sql, ...params).
interface DbHelper {
  prepare: (sql: string) => {
    get: (...params: any[]) => any;
    all: (...params: any[]) => any[];
    run: (...params: any[]) => { changes: number };
  };
  run: (sql: string, ...params: any[]) => { changes: number };
}

async function initSqlite(): Promise<SqlJsDatabase> {
  const SQL = await initSqlJs();
  const dbDir = path.dirname(config.dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  if (fs.existsSync(config.dbPath)) {
    const buffer = fs.readFileSync(config.dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA foreign_keys=ON');
  return db;
}

function createDbHelper(database: SqlJsDatabase): DbHelper {
  const runRaw = (sql: string, ...params: any[]) => {
    database.run(sql, params);
    return { changes: database.getRowsModified() };
  };
  const getRow = (sql: string, ...params: any[]) => {
    const stmt = database.prepare(sql);
    stmt.bind(params || []);
    let row: any;
    if (stmt.step()) {
      row = stmt.getAsObject();
    }
    stmt.free();
    return row;
  };
  const allRows = (sql: string, ...params: any[]) => {
    const stmt = database.prepare(sql);
    stmt.bind(params || []);
    const rows: any[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  };
  return {
    prepare: (sql: string) => ({
      get: (...params: any[]) => getRow(sql, ...params),
      all: (...params: any[]) => allRows(sql, ...params),
      run: (...params: any[]) => runRaw(sql, ...params),
    }),
    run: (sql: string, ...params: any[]) => runRaw(sql, ...params),
  };
}

let dbHelper: DbHelper;

export async function initDb(): Promise<DbHelper> {
  await initSqlite();
  initializeSchema();
  persistDb();
  dbHelper = createDbHelper(db);
  return dbHelper;
}

export function getDb(): DbHelper {
  if (!dbHelper) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return dbHelper;
}

/** Direct access to the underlying sql.js DB (for special operations). */
export function getRawDb(): SqlJsDatabase {
  if (!db) throw new Error('Database not initialized');
  return db;
}

function initializeSchema(): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      subscription_tier TEXT NOT NULL DEFAULT 'FREE',
      password_reset_token TEXT,
      password_reset_expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  // Migration for DBs created before subscription_tier existed.
  try { db.run('ALTER TABLE users ADD COLUMN subscription_tier TEXT NOT NULL DEFAULT \'FREE\''); } catch { /* already exists */ }

  // Audit tables (mirrored from the monolith's server/src/db.ts, self-contained)
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_reports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      target_url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      overall_score INTEGER,
      summary TEXT,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_dimensions (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      dimension TEXT NOT NULL,
      label TEXT NOT NULL,
      icon TEXT,
      score INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pass',
      summary TEXT,
      FOREIGN KEY (report_id) REFERENCES audit_reports(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_checks (
      id TEXT PRIMARY KEY,
      dimension_id TEXT NOT NULL,
      check_name TEXT NOT NULL,
      label TEXT NOT NULL,
      passed INTEGER NOT NULL DEFAULT 0,
      severity TEXT NOT NULL DEFAULT 'info',
      detail TEXT,
      recommendation TEXT,
      FOREIGN KEY (dimension_id) REFERENCES audit_dimensions(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_usage (
      user_id TEXT PRIMARY KEY,
      audits_run INTEGER NOT NULL DEFAULT 0,
      last_audit_at TEXT
    )
  `);

  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
    'CREATE INDEX IF NOT EXISTS idx_audit_reports_user_id ON audit_reports(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_reports_status ON audit_reports(status)',
    'CREATE INDEX IF NOT EXISTS idx_audit_dimensions_report_id ON audit_dimensions(report_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_checks_dimension_id ON audit_checks(dimension_id)',
  ];
  for (const idx of indexes) {
    try { db.run(idx); } catch { /* may already exist */ }
  }
}

export function persistDb(): void {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(config.dbPath, buffer);
  }
}

export function closeDb(): void {
  if (db) {
    persistDb();
    db.close();
  }
}
