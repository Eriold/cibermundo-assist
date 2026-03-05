import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta real del archivo .db
const DB_PATH = path.resolve(__dirname, "../../../../data/app.db");

// Tipos mínimos (sql.js no exporta tipos fuertes)
type SqlJsDatabase = any;

let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;
let db: SqlJsDatabase | null = null;

// Control de guardado
let dirty = false;
let saveTimer: NodeJS.Timeout | null = null;

/**
 * Guarda la DB en disco con debounce (evita escribir a cada query)
 */
function scheduleSave() {
  dirty = true;

  if (saveTimer) return;

  saveTimer = setTimeout(() => {
    saveTimer = null;

    if (!dirty || !db) return;

    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
    dirty = false;
  }, 1000); // guarda cada 1s si hubo cambios
}

/**
 * Inicializa sql.js y carga la DB desde disco (si existe)
 */
export async function getDb(): Promise<SqlJsDatabase> {
  if (db) return db;

  SQL = await initSqlJs({
    // Normalmente no hace falta locateFile en Node
    // Si algún día falla, se puede forzar aquí
  });

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(new Uint8Array(fileBuffer));
  } else {
    db = new SQL.Database();
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }

  return db!;
}

/**
 * Ejecuta SQL sin devolver filas (CREATE, INSERT, UPDATE)
 */
export async function exec(sql: string): Promise<void> {
  const d = await getDb();
  d.exec(sql);
  scheduleSave();
}

/**
 * Ejecuta SQL con parámetros (INSERT / UPDATE)
 */
export async function run(sql: string, params: any[] = []): Promise<void> {
  const d = await getDb();
  const stmt = d.prepare(sql);

  try {
    stmt.bind(params);
    stmt.step();
  } finally {
    stmt.free();
  }

  scheduleSave();
}

/**
 * Devuelve múltiples filas
 */
export async function all<T = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const d = await getDb();
  const stmt = d.prepare(sql);
  const rows: T[] = [];

  try {
    stmt.bind(params);
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T);
    }
  } finally {
    stmt.free();
  }

  return rows;
}

/**
 * Devuelve una sola fila o undefined
 */
export async function get<T = any>(
  sql: string,
  params: any[] = []
): Promise<T | undefined> {
  const d = await getDb();
  const stmt = d.prepare(sql);

  try {
    stmt.bind(params);
    if (!stmt.step()) return undefined;
    return stmt.getAsObject() as T;
  } finally {
    stmt.free();
  }
}
