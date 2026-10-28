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
  applyMigrations();
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

// ---------------------------------------------------------------------------
// Migrations
//
// Each migration is a set of statements applied once, in order, and recorded in
// `schema_migrations`. A brand-new database therefore gets the full Blueprint
// schema from migration 001 and later column additions can be appended as new
// entries without re-running anything.
// ---------------------------------------------------------------------------

interface Migration {
  id: string;
  statements: string[];
}

/**
 * Blueprint's own schema: `users` + the 15 Blueprint domain tables.
 *
 * The table and column definitions are mirrored from the monolith's
 * `server/src/db.ts` so Phase 2 can port the routes without a data-model change.
 * Audit and Pipeline tables are intentionally NOT created here — they belong to
 * their own standalone apps.
 */
const MIGRATIONS: Migration[] = [
  {
    id: '001_initial_schema',
    statements: [
      // --- users -----------------------------------------------------------
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        subscription_tier TEXT NOT NULL DEFAULT 'FREE',
        verified INTEGER NOT NULL DEFAULT 0,
        verification_token TEXT,
        reset_token TEXT,
        reset_token_expiry TEXT,
        trial_started_at TEXT,
        trial_ends_at TEXT,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,

      // --- projects --------------------------------------------------------
      `CREATE TABLE IF NOT EXISTS projects (
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
      )`,

      // --- pages (sitemap hierarchy) ---------------------------------------
      `CREATE TABLE IF NOT EXISTS pages (
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
      )`,

      // --- questionnaires (one per page) -----------------------------------
      `CREATE TABLE IF NOT EXISTS questionnaires (
        id TEXT PRIMARY KEY,
        page_id TEXT NOT NULL UNIQUE,
        questions TEXT NOT NULL,
        answers TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
      )`,

      // --- wireframes (one per page) ---------------------------------------
      `CREATE TABLE IF NOT EXISTS wireframes (
        id TEXT PRIMARY KEY,
        page_id TEXT NOT NULL UNIQUE,
        blocks TEXT NOT NULL,
        approval_status TEXT DEFAULT 'draft',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
      )`,

      // --- proposals (one per project) -------------------------------------
      `CREATE TABLE IF NOT EXISTS proposals (
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
      )`,

      // --- team membership (Team tier, 5 seats) ----------------------------
      `CREATE TABLE IF NOT EXISTS team_members (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        status TEXT NOT NULL DEFAULT 'invited',
        invited_at TEXT NOT NULL DEFAULT (datetime('now')),
        accepted_at TEXT,
        FOREIGN KEY (account_id) REFERENCES users(id)
      )`,

      // --- white-label settings (Agency) -----------------------------------
      `CREATE TABLE IF NOT EXISTS whitelabel_settings (
        user_id TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 0,
        company_name TEXT,
        logo_url TEXT,
        primary_color TEXT DEFAULT '#1A9EF2',
        secondary_color TEXT DEFAULT '#4551D3',
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,

      // --- monthly project counters for paid tier limits -------------------
      `CREATE TABLE IF NOT EXISTS project_monthly (
        user_id TEXT NOT NULL,
        month_key TEXT NOT NULL,
        project_count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, month_key),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,

      // --- project-level collaborators ------------------------------------
      `CREATE TABLE IF NOT EXISTS project_members (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'editor',
        access_token TEXT,
        status TEXT NOT NULL DEFAULT 'invited',
        invited_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )`,

      // --- wireframe comments ----------------------------------------------
      `CREATE TABLE IF NOT EXISTS wireframe_comments (
        id TEXT PRIMARY KEY,
        wireframe_id TEXT NOT NULL,
        block_id TEXT NOT NULL,
        user_email TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (wireframe_id) REFERENCES wireframes(id) ON DELETE CASCADE
      )`,

      // --- agency API keys -------------------------------------------------
      `CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        key_hash TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL DEFAULT 'Default',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_used_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,

      // --- custom domains (Agency) -----------------------------------------
      `CREATE TABLE IF NOT EXISTS custom_domains (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        domain TEXT NOT NULL UNIQUE,
        verification_token TEXT NOT NULL,
        verified INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        verified_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,

      // --- Blueprint white-label (separate from Audit's whitelabel) --------
      `CREATE TABLE IF NOT EXISTS blueprint_whitelabel (
        user_id TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 0,
        company_name TEXT,
        logo_url TEXT,
        primary_color TEXT DEFAULT '#1A9EF2',
        secondary_color TEXT DEFAULT '#4551D3',
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,

      // --- invite codes (manual tier onboarding without Stripe) ------------
      `CREATE TABLE IF NOT EXISTS invite_codes (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        tier TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        max_uses INTEGER DEFAULT 1,
        uses INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1
      )`,

      // --- promo code redemptions -----------------------------------------
      `CREATE TABLE IF NOT EXISTS promo_redemptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL,
        product TEXT NOT NULL,
        tier TEXT NOT NULL,
        interval TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )`,

      // --- indexes ---------------------------------------------------------
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token)',
      'CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token)',
      'CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id)',
      'CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription_id ON users(stripe_subscription_id)',
      'CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_pages_project_id ON pages(project_id)',
      'CREATE INDEX IF NOT EXISTS idx_pages_parent_id ON pages(parent_id)',
      'CREATE INDEX IF NOT EXISTS idx_team_members_account_id ON team_members(account_id)',
      'CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email)',
      'CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id)',
      'CREATE INDEX IF NOT EXISTS idx_wireframe_comments_wireframe_id ON wireframe_comments(wireframe_id)',
      'CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_custom_domains_user_id ON custom_domains(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code)',
      'CREATE INDEX IF NOT EXISTS idx_promo_redemptions_code ON promo_redemptions(code, product, tier, interval)',
      'CREATE INDEX IF NOT EXISTS idx_proposals_project_id ON proposals(project_id)',
      'CREATE INDEX IF NOT EXISTS idx_project_monthly_month_key ON project_monthly(month_key)',
    ],
  },
];

function applyMigrations(): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set<string>();
  const stmt = db.prepare('SELECT id FROM schema_migrations');
  while (stmt.step()) {
    applied.add(String(stmt.getAsObject().id));
  }
  stmt.free();

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    for (const statement of migration.statements) {
      db.run(statement);
    }
    db.run('INSERT INTO schema_migrations (id) VALUES (?)', [migration.id]);
    console.log(`[Nuria Website Blueprint] Applied migration ${migration.id}`);
  }
}

/** Names of the tables this app owns (used by /api/health and the boot log). */
export function getTableNames(): string[] {
  const stmt = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  const names: string[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as { name?: unknown };
    if (typeof row.name === 'string') names.push(row.name);
  }
  stmt.free();
  return names;
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
