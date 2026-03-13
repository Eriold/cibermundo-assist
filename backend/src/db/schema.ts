import { run } from "./index.js";

export function initSchema() {
  run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      pin TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      can_scan INTEGER NOT NULL DEFAULT 0,
      can_report INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `);

  // Insertar Admin por defecto (si no hay ninguno)
  run(`
    INSERT OR IGNORE INTO users (id, name, username, pin, is_admin, can_scan, can_report, created_at)
    VALUES (1, 'Administrador', 'admin', '1234', 1, 1, 1, datetime('now'))
  `);

  run(`
    CREATE TABLE IF NOT EXISTS zones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )
  `);

  run(`
    CREATE TABLE IF NOT EXISTS statuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )
  `);

  run(`
    INSERT OR IGNORE INTO statuses (id, name, active, created_at)
    VALUES 
      (1, 'Abierto', 1, datetime('now')),
      (2, 'Cerrado', 1, datetime('now'))
  `);

  run(`
    CREATE TABLE IF NOT EXISTS managements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )
  `);

  run(`
    INSERT OR IGNORE INTO managements (id, name, active, created_at)
    VALUES 
      (1, 'Sin gestión', 1, datetime('now')),
      (2, 'Entregado', 1, datetime('now')),
      (3, 'Devuelto', 1, datetime('now'))
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
      status_id INTEGER DEFAULT 1,      -- 1: Abierto
      management_id INTEGER DEFAULT 1,  -- 1: Sin gestion

      office_status TEXT NOT NULL DEFAULT 'PAQUETE_INGRESADO',
      notes TEXT,
      obs_1 TEXT,
      obs_2 TEXT,
      obs_3 TEXT,

      client_name TEXT,
      client_phone TEXT,
      checkout_date TEXT,
      checkout_by INTEGER,
      message_sent INTEGER DEFAULT 0,

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
      amount_to_collect INTEGER,

      gestion_count INTEGER DEFAULT 0
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
      status_id INTEGER,
      management_id INTEGER,
      office_status TEXT NOT NULL,
      notes TEXT,
      obs_1 TEXT,
      obs_2 TEXT,
      obs_3 TEXT,
      client_name TEXT,
      client_phone TEXT,
      checkout_date TEXT,
      checkout_by INTEGER,
      message_sent INTEGER DEFAULT 0,
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
      amount_to_collect INTEGER,

      gestion_count INTEGER DEFAULT 0
    )
  `);

  // Tabla para almacenar historial del Flujo Guía (APX portal)
  run(`
    CREATE TABLE IF NOT EXISTS shipment_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_number TEXT NOT NULL,
      ciudad TEXT,
      descripcion_estado TEXT,
      fecha_cambio_estado TEXT,
      bodega TEXT,
      motivo TEXT,
      mensajero TEXT,
      numero_tipo_impreso TEXT,
      descripcion_tipo_impreso TEXT,
      usuario TEXT,
      observacion TEXT,
      has_location_icon INTEGER DEFAULT 0,
      fetched_at TEXT NOT NULL,
      FOREIGN KEY (tracking_number) REFERENCES shipments(tracking_number)
    )
  `);

  run(`
    CREATE INDEX IF NOT EXISTS idx_shipment_tracking_tn
    ON shipment_tracking(tracking_number)
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
