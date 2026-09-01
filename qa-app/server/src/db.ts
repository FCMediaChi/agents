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
      password_reset_token TEXT,
      password_reset_expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      website_url TEXT,
      client_name TEXT,
      platform TEXT NOT NULL DEFAULT 'Other',
      website_type TEXT NOT NULL DEFAULT 'Other',
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'not_started',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS qa_runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      label TEXT,
      version TEXT NOT NULL DEFAULT '1.0',
      started_at TEXT,
      completed_at TEXT,
      score INTEGER,
      completion_percentage REAL,
      launch_status TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS checklist_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      "order" INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS checklist_items (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      severity TEXT NOT NULL DEFAULT 'medium',
      remediation_guidance TEXT,
      ai_prompt_context TEXT,
      recommended INTEGER NOT NULL DEFAULT 1,
      applicable_platforms TEXT,
      applicable_site_types TEXT,
      "order" INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      version TEXT NOT NULL DEFAULT '1.0',
      FOREIGN KEY (category_id) REFERENCES checklist_categories(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS qa_results (
      id TEXT PRIMARY KEY,
      qa_run_id TEXT NOT NULL,
      checklist_item_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_reviewed',
      notes TEXT,
      reviewed_at TEXT,
      reviewed_by TEXT,
      FOREIGN KEY (qa_run_id) REFERENCES qa_runs(id) ON DELETE CASCADE,
      FOREIGN KEY (checklist_item_id) REFERENCES checklist_items(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ai_interactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT,
      qa_run_id TEXT,
      operation TEXT NOT NULL,
      input_reference TEXT,
      output_reference TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      FOREIGN KEY (qa_run_id) REFERENCES qa_runs(id) ON DELETE SET NULL
    )
  `);

  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
    'CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status)',
    'CREATE INDEX IF NOT EXISTS idx_qa_runs_project_id ON qa_runs(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_checklist_items_category_id ON checklist_items(category_id)',
    'CREATE INDEX IF NOT EXISTS idx_qa_results_qa_run_id ON qa_results(qa_run_id)',
    'CREATE INDEX IF NOT EXISTS idx_qa_results_checklist_item_id ON qa_results(checklist_item_id)',
    'CREATE INDEX IF NOT EXISTS idx_ai_interactions_user_id ON ai_interactions(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_ai_interactions_project_id ON ai_interactions(project_id)',
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
