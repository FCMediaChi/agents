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
      trial_started_at TEXT,
      trial_ends_at TEXT,
      password_reset_token TEXT,
      password_reset_expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Pipeline tables (mirrored from the monolith's server/src/db.ts, self-contained)
  db.run(`
    CREATE TABLE IF NOT EXISTS pipeline_agencies (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      agency_name TEXT NOT NULL,
      website_url TEXT,
      services TEXT,
      industries TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pipeline_case_studies (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      client_name TEXT NOT NULL,
      client_url TEXT,
      old_site_url TEXT,
      screenshots TEXT,
      traffic_data TEXT,
      revenue_data TEXT,
      generated_content TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pipeline_pitches (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      prospect_name TEXT NOT NULL,
      prospect_url TEXT,
      audit_results TEXT,
      cold_email TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
    'CREATE INDEX IF NOT EXISTS idx_pipeline_agencies_user_id ON pipeline_agencies(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_pipeline_case_studies_user_id ON pipeline_case_studies(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_pipeline_pitches_user_id ON pipeline_pitches(user_id)',
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
