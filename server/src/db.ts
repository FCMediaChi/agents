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
      trial_started_at TEXT,
      trial_ends_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  // Add trial columns if users table existed before this migration
  try { db.run('ALTER TABLE users ADD COLUMN trial_started_at TEXT'); } catch { /* already exists */ }
  try { db.run('ALTER TABLE users ADD COLUMN trial_ends_at TEXT'); } catch { /* already exists */ }

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

  // Audit tables
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
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
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
      last_audit_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Team membership
  db.run(`
    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      status TEXT NOT NULL DEFAULT 'invited',
      invited_at TEXT NOT NULL DEFAULT (datetime('now')),
      accepted_at TEXT,
      FOREIGN KEY (account_id) REFERENCES users(id)
    )
  `);

  // White-label settings for agency users
  db.run(`
    CREATE TABLE IF NOT EXISTS whitelabel_settings (
      user_id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 0,
      company_name TEXT,
      logo_url TEXT,
      primary_color TEXT DEFAULT '#1A9EF2',
      secondary_color TEXT DEFAULT '#4551D3',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Monthly project counters for paid tier limits
  db.run(`
    CREATE TABLE IF NOT EXISTS project_monthly (
      user_id TEXT NOT NULL,
      month_key TEXT NOT NULL,
      project_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, month_key),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Project-level members for collaboration
  db.run(`
    CREATE TABLE IF NOT EXISTS project_members (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'editor',
      access_token TEXT,
      status TEXT NOT NULL DEFAULT 'invited',
      invited_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);
  // Add access_token column if table was created before this migration
  try { db.run('ALTER TABLE project_members ADD COLUMN access_token TEXT'); } catch { /* already exists */ }

  // Wireframe comments
  db.run(`
    CREATE TABLE IF NOT EXISTS wireframe_comments (
      id TEXT PRIMARY KEY,
      wireframe_id TEXT NOT NULL,
      block_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (wireframe_id) REFERENCES wireframes(id) ON DELETE CASCADE
    )
  `);

  // Wireframe approval status
  try { db.run('ALTER TABLE wireframes ADD COLUMN approval_status TEXT DEFAULT \'draft\''); } catch { /* already exists */ }

  // API keys for agency users
  db.run(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT 'Default',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_used_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Custom domains for agency users
  db.run(`
    CREATE TABLE IF NOT EXISTS custom_domains (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      domain TEXT NOT NULL UNIQUE,
      verification_token TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      verified_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Blueprint white-label settings (separate from Audit whitelabel)
  db.run(`
    CREATE TABLE IF NOT EXISTS blueprint_whitelabel (
      user_id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 0,
      company_name TEXT,
      logo_url TEXT,
      primary_color TEXT DEFAULT '#1A9EF2',
      secondary_color TEXT DEFAULT '#4551D3',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Pipeline tables
  db.run(`
    CREATE TABLE IF NOT EXISTS pipeline_agencies (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      agency_name TEXT NOT NULL,
      website TEXT,
      niche TEXT,
      team_size TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pipeline_case_studies (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      agency_id TEXT,
      client_name TEXT NOT NULL,
      industry TEXT,
      challenge TEXT,
      solution TEXT,
      results TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (agency_id) REFERENCES pipeline_agencies(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pipeline_pitches (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      agency_id TEXT,
      prospect_name TEXT NOT NULL,
      company_name TEXT,
      industry TEXT,
      pain_points TEXT,
      proposed_solution TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (agency_id) REFERENCES pipeline_agencies(id) ON DELETE SET NULL
    )
  `);

  // Create indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
    'CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_pages_project_id ON pages(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_pages_parent_id ON pages(parent_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_reports_user_id ON audit_reports(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_reports_status ON audit_reports(status)',
    'CREATE INDEX IF NOT EXISTS idx_audit_dimensions_report_id ON audit_dimensions(report_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_checks_dimension_id ON audit_checks(dimension_id)',
    'CREATE INDEX IF NOT EXISTS idx_team_members_account_id ON team_members(account_id)',
    'CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email)',
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