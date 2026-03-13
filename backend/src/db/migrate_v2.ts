import { run, all, initDb } from "./index.js";

async function runMigration() {
  console.log("=== INICIANDO MIGRACIÓN V2 CIBERMUNDO-ASSIST ===");
  try {
    await initDb();
    // 1. Crear tablas auxiliares si no existen
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

    console.log("✓ Tablas Statuses y Managements listas.");

    // 2. Comprobar e insertar columnas nuevas en `shipments`
    const colsShipments: any[] = all("PRAGMA table_info(shipments)");
    const existingShipmentCols = colsShipments.map(c => c.name);

    const checkAndAddColumn = (table: string, existingCols: string[], colName: string, defSQL: string) => {
        if (!existingCols.includes(colName)) {
            run(`ALTER TABLE ${table} ADD COLUMN ${colName} ${defSQL}`);
            console.log(`+ Columna añadida ${table}.${colName}`);
        }
    };

    // Nuevas columnas requeridas para Fase 7/8
    checkAndAddColumn('shipments', existingShipmentCols, 'status_id', 'INTEGER DEFAULT 1');
    checkAndAddColumn('shipments', existingShipmentCols, 'management_id', 'INTEGER DEFAULT 1');
    checkAndAddColumn('shipments', existingShipmentCols, 'obs_1', 'TEXT');
    checkAndAddColumn('shipments', existingShipmentCols, 'obs_2', 'TEXT');
    checkAndAddColumn('shipments', existingShipmentCols, 'obs_3', 'TEXT');
    checkAndAddColumn('shipments', existingShipmentCols, 'client_name', 'TEXT');
    checkAndAddColumn('shipments', existingShipmentCols, 'client_phone', 'TEXT');
    checkAndAddColumn('shipments', existingShipmentCols, 'checkout_date', 'TEXT');
    checkAndAddColumn('shipments', existingShipmentCols, 'checkout_by', 'INTEGER');
    checkAndAddColumn('shipments', existingShipmentCols, 'message_sent', 'INTEGER DEFAULT 0');

    // Mismo proceso para shipments_archive
    run(`CREATE TABLE IF NOT EXISTS shipments_archive (tracking_number TEXT PRIMARY KEY, archived_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, scanned_at TEXT NOT NULL, scanned_by TEXT NOT NULL, delivery_type TEXT NOT NULL, zone_id INTEGER, office_status TEXT NOT NULL, notes TEXT, recipient_name TEXT, recipient_id TEXT, recipient_phone TEXT, api_last_fetch_at TEXT, apx_last_fetch_at TEXT, api_success INTEGER DEFAULT 0, api_message TEXT, api_current_state_id INTEGER, api_current_state_desc TEXT, api_current_city TEXT, api_current_state_at TEXT, payment_code INTEGER, payment_desc TEXT, amount_total INTEGER, amount_declared INTEGER, amount_to_collect INTEGER)`);
    const colsArchive: any[] = all("PRAGMA table_info(shipments_archive)");
    const existingArchiveCols = colsArchive.map(c => c.name);

    checkAndAddColumn('shipments_archive', existingArchiveCols, 'status_id', 'INTEGER');
    checkAndAddColumn('shipments_archive', existingArchiveCols, 'management_id', 'INTEGER');
    checkAndAddColumn('shipments_archive', existingArchiveCols, 'obs_1', 'TEXT');
    checkAndAddColumn('shipments_archive', existingArchiveCols, 'obs_2', 'TEXT');
    checkAndAddColumn('shipments_archive', existingArchiveCols, 'obs_3', 'TEXT');
    checkAndAddColumn('shipments_archive', existingArchiveCols, 'client_name', 'TEXT');
    checkAndAddColumn('shipments_archive', existingArchiveCols, 'client_phone', 'TEXT');
    checkAndAddColumn('shipments_archive', existingArchiveCols, 'checkout_date', 'TEXT');
    checkAndAddColumn('shipments_archive', existingArchiveCols, 'checkout_by', 'INTEGER');
    checkAndAddColumn('shipments_archive', existingArchiveCols, 'message_sent', 'INTEGER DEFAULT 0');

    // Fase 8: Gestión Tracking
    checkAndAddColumn('shipments', existingShipmentCols, 'gestion_count', 'INTEGER DEFAULT 0');
    checkAndAddColumn('shipments_archive', existingArchiveCols, 'gestion_count', 'INTEGER DEFAULT 0');

    // Crear tabla shipment_tracking para historial del Flujo Guía (APX)
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
    console.log("✓ Tabla shipment_tracking y columna gestion_count listas.");

    console.log("=== MIGRACIÓN COMPLETADA EXITOSAMENTE ===");

  } catch (err) {
    console.error("ERROR EN MIGRAION V2:", err);
  }
}

runMigration();
