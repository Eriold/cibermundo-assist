import { Router, Request, Response, NextFunction } from "express";
import { run, exec, getDb } from "../db/index.js";

const router = Router();

// POST /admin/archive
// Archiva registros de `shipments` que tengan más de 30 días de antigüedad en `shipments_archive`.
router.post("/archive", (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    
    // Iniciar transacción
    db.exec("BEGIN TRANSACTION;");

    try {
      // 1. Insertar en shipments_archive copiando los viejos
      const archiveSql = `
        INSERT INTO shipments_archive (
          tracking_number, archived_at, created_at, updated_at, scanned_at, scanned_by,
          delivery_type, zone_id, office_status, notes, recipient_name, recipient_id,
          recipient_phone, api_last_fetch_at, apx_last_fetch_at, api_success, api_message,
          api_current_state_id, api_current_state_desc, api_current_city, api_current_state_at,
          payment_code, payment_desc, amount_total, amount_declared, amount_to_collect
        )
        SELECT 
          tracking_number, datetime('now'), created_at, updated_at, scanned_at, scanned_by,
          delivery_type, zone_id, office_status, notes, recipient_name, recipient_id,
          recipient_phone, api_last_fetch_at, apx_last_fetch_at, api_success, api_message,
          api_current_state_id, api_current_state_desc, api_current_city, api_current_state_at,
          payment_code, payment_desc, amount_total, amount_declared, amount_to_collect
        FROM shipments
        WHERE scanned_at <= datetime('now', '-30 days')
      `;
      const result = db.prepare(archiveSql).run();
      const affectedRows = result.changes;

      // 3. Eliminar los originales
      if (affectedRows > 0) {
        db.prepare("DELETE FROM shipments WHERE scanned_at <= datetime('now', '-30 days')").run();
      }

      // Commit
      db.exec("COMMIT;");

      res.json({ success: true, archived_count: affectedRows });
    } catch (dbErr) {
      db.exec("ROLLBACK;");
      throw dbErr;
    }

  } catch (e) {
    next(e);
  }
});

export default router;
