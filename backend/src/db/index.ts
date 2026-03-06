import Database, { Database as SQLiteDatabase } from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(
  __dirname,
  process.env.DB_PATH || "../../data/app.db"
);

let dbInstance: SQLiteDatabase | null = null;

export function getDbPath(): string {
  return dbPath;
}

export async function initDb() {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  dbInstance = new Database(dbPath);
  dbInstance.pragma("journal_mode = WAL");
  dbInstance.pragma("synchronous = NORMAL");
  return dbInstance;
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

export function exec(sql: string): void {
  const db = getDb();
  db.exec(sql);
}
