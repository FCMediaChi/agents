import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { config } from './config.js';

let db: SqlJsDatabase;

// Helper to convert sql.js results to better-sqlite3-compatible API
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

function createDbHelper(db: SqlJsDatabase): DbHelper {
  const runRaw = (sql: string, ...params: any[]) => {
    try {
      db.run(sql, params);
      return { changes: db.getRowsModified() };
    } catch (e) {
      throw e;
    }
  };

  const getRow = (sql: string, ...params: any[]) => {
    const stmt = db.prepare(sql);
    stmt.bind(params || []);
    let row: any = undefined;
    if (stmt.step()) {
      row = stmt.getAsObject();
    }
    stmt.free();
    return row;
  };

  const allRows = (sql: string, ...params: any[]) => {
    const stmt = db.prepare(sql);
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

/** Direct access to the underlying sql.js DB (for special operations) */
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      branding_logo_url TEXT,
      branding_primary_color TEXT DEFAULT '#3B82F6',
      branding_secondary_color TEXT DEFAULT '#1F2937',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      parent_id TEXT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      page_type TEXT NOT NULL DEFAULT 'generic',
      description TEXT,
      goals TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES pages(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS questionnaires (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL UNIQUE,
      questions TEXT NOT NULL,
      answers TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS wireframes (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL UNIQUE,
      blocks TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL UNIQUE,
      client_name TEXT NOT NULL,
      executive_summary TEXT,
      pricing_estimate TEXT,
      timeline_weeks INTEGER DEFAULT 4,
      terms_conditions TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Create indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
    'CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_pages_project_id ON pages(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_pages_parent_id ON pages(parent_id)',
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