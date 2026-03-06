import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(
  __dirname,
  process.env.DB_PATH || "../../data/app.db"
);

let dbInstance: SqlJsDatabase | null = null;
let saveTimeout: NodeJS.Timeout | null = null;

export function getDbPath(): string {
  return dbPath;
}

export async function initDb() {
  const SQL = await initSqlJs();
  
  // Cargar DB existente o crear nueva
  if (fs.existsSync(dbPath)) {
    const data = fs.readFileSync(dbPath);
    dbInstance = new SQL.Database(data);
  } else {
    dbInstance = new SQL.Database();
  }
  
  return dbInstance;
}

export function getDb(): SqlJsDatabase {
  if (!dbInstance) {
    throw new Error("Database not initialized. Call initDb() first.");
  }
  return dbInstance;
}

export function saveDb() {
  if (!dbInstance) return;
  
  // Debounce: evitar guardar múltiples veces en corto tiempo
  if (saveTimeout) clearTimeout(saveTimeout);
  
  saveTimeout = setTimeout(() => {
    // Crear carpeta si no existe
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const data = dbInstance!.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  }, 500); // Esperar 500ms después del último cambio
}

/**
 * Fuerza una save inmediata (sin debounce)
 * Util para operaciones criticas donde necesitas garantizar persistencia
 */
export function saveDbImmediate() {
  if (!dbInstance) return;

  // Cancelar debounce pendiente
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }

  // Guardar inmediatamente
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const data = dbInstance!.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

// Helpers - sincronos, guardan inmediatamente
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

// Para queries de lectura sin modificar
export function exec(sql: string): any[] {
  const db = getDb();
  return db.exec(sql);
}
