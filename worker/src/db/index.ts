import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(
  __dirname,
  process.env.DB_PATH || "../../../backend/data/app.db"
);

let dbInstance: SqlJsDatabase | null = null;
let saveTimeout: NodeJS.Timeout | null = null;

export function getDbPath(): string {
  return dbPath;
}

export async function initDb() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const data = fs.readFileSync(dbPath);
    dbInstance = new SQL.Database(data);
  } else {
    // Si la db no existe (backend no ha iniciado), creamos una nueva vacia y FORZAMOS SU ESTRUCTURA
    dbInstance = new SQL.Database();
    initSchema(); // Asegura crear tablas (soluciona la condicion de carrera "no such table")
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

export function getDb(): SqlJsDatabase {
  if (!dbInstance) {
    throw new Error("Database not initialized. Call initDb() first.");
  }
  return dbInstance;
}

export function saveDb() {
  if (!dbInstance) return;
  if (saveTimeout) clearTimeout(saveTimeout);
  
  saveTimeout = setTimeout(() => {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = dbInstance!.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  }, 500);
}

export function saveDbImmediate() {
  if (!dbInstance) return;
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const data = dbInstance!.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

export function run(sql: string, params: Record<string, any> = {}) {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();
  saveDbImmediate();
}

export function get<T = any>(sql: string, params: Record<string, any> = {}): T | undefined {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  
  if (!stmt.step()) {
    stmt.free();
    return undefined;
  }
  
  const row = stmt.getAsObject();
  stmt.free();
  return row as T;
}

export function all<T = any>(sql: string, params: Record<string, any> = {}): T[] {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}
