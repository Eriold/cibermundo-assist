import { run } from "./index.js";

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
      -- Copia de todos los demas campos de shipments
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
