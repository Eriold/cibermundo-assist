import Database, { Database as SQLiteDatabase } from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(
  __dirname,
  process.env.DB_PATH || "../../../backend/data/app.db"
);

let dbInstance: SQLiteDatabase | null = null;

export function getDbPath(): string {
  return dbPath;
}

export async function initDb() {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const exists = fs.existsSync(dbPath);
  dbInstance = new Database(dbPath);
  dbInstance.pragma("journal_mode = WAL");
  dbInstance.pragma("synchronous = NORMAL");
  
  if (!exists) {
    initSchema();
  }
  
  return dbInstance;
}

export function initSchema() {
  run(`
    CREATE TABLE IF NOT EXISTS zones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )
  `);

  run(`
    CREATE TABLE IF NOT EXISTS shipments (
      tracking_number TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      scanned_at TEXT NOT NULL,
      scanned_by TEXT NOT NULL,
      delivery_type TEXT NOT NULL,
      zone_id INTEGER,
      office_status TEXT NOT NULL DEFAULT 'PAQUETE_INGRESADO',
      notes TEXT,
      recipient_name TEXT,
      recipient_id TEXT,
      recipient_phone TEXT,
      api_last_fetch_at TEXT,
      apx_last_fetch_at TEXT,
      api_success INTEGER DEFAULT 0,
      api_message TEXT,
      api_current_state_id INTEGER,
      api_current_state_desc TEXT,
      api_current_city TEXT,
      api_current_state_at TEXT,
      payment_code INTEGER,
      payment_desc TEXT,
      amount_total INTEGER,
      amount_declared INTEGER,
      amount_to_collect INTEGER
    )
  `);

  run(`
    CREATE TABLE IF NOT EXISTS shipments_archive (
      tracking_number TEXT PRIMARY KEY,
      archived_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      scanned_at TEXT NOT NULL,
      scanned_by TEXT NOT NULL,
      delivery_type TEXT NOT NULL,
      zone_id INTEGER,
      office_status TEXT NOT NULL,
      notes TEXT,
      recipient_name TEXT,
      recipient_id TEXT,
      recipient_phone TEXT,
      api_last_fetch_at TEXT,
      apx_last_fetch_at TEXT,
      api_success INTEGER DEFAULT 0,
      api_message TEXT,
      api_current_state_id INTEGER,
      api_current_state_desc TEXT,
      api_current_city TEXT,
      api_current_state_at TEXT,
      payment_code INTEGER,
      payment_desc TEXT,
      amount_total INTEGER,
      amount_declared INTEGER,
      amount_to_collect INTEGER
    )
  `);

  run(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      tracking_number TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      run_after TEXT NOT NULL,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  run(`
    CREATE INDEX IF NOT EXISTS idx_jobs_status_run_after
    ON jobs(status, run_after)
  `);

  run(`
    CREATE INDEX IF NOT EXISTS idx_shipments_office_status
    ON shipments(office_status)
  `);

  run(`
    CREATE INDEX IF NOT EXISTS idx_jobs_tracking
    ON jobs(tracking_number)
  `);
}

export function getDb(): SQLiteDatabase {
  if (!dbInstance) {
    throw new Error("Database not initialized. Call initDb() first.");
  }
  return dbInstance;
}

export function saveDb() { /* no op for better-sqlite3 */ }
export function saveDbImmediate() { /* no op for better-sqlite3 */ }

function bindParams(stmt: any, params: Record<string, any> = {}) {
  // Strip prefixes for named parameters internally if object provided
  // better-sqlite3 handles '?' parameters via varargs
  if (Array.isArray(params)) {
    return params;
  }
  const sanitized: Record<string, any> = {};
  for (const [k, v] of Object.entries(params)) {
    const key = k.startsWith(":") || k.startsWith("@") || k.startsWith("$") ? k.substring(1) : k;
    sanitized[key] = v;
  }
  return sanitized;
}

export function run(sql: string, params: any = {}) {
  const db = getDb();
  const stmt = db.prepare(sql);
  const p = bindParams(stmt, params);
  if (Array.isArray(p)) stmt.run(...p); else stmt.run(p);
}

export function get<T = any>(sql: string, params: any = {}): T | undefined {
  const db = getDb();
  const stmt = db.prepare(sql);
  const p = bindParams(stmt, params);
  const res = Array.isArray(p) ? stmt.get(...p) : stmt.get(p);
  return res as T | undefined;
}

export function all<T = any>(sql: string, params: any = {}): T[] {
  const db = getDb();
  const stmt = db.prepare(sql);
  const p = bindParams(stmt, params);
  return (Array.isArray(p) ? stmt.all(...p) : stmt.all(p)) as T[];
}
