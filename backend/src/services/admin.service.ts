import { getDb } from "../db/index.js";

interface ArchiveOldShipmentsResult {
  archived_count: number;
  success: true;
}

export const archiveOldShipments = (): ArchiveOldShipmentsResult => {
  const db = getDb();

  db.exec("BEGIN TRANSACTION;");

  try {
    const archiveSql = `
      INSERT INTO shipments_archive (
        tracking_number, archived_at, created_at, updated_at, scanned_at, scanned_by,
        delivery_type, zone_id, status_id, management_id, office_status, notes,
        obs_1, obs_2, obs_3, client_name, client_phone, checkout_date, checkout_by,
        message_sent, recipient_name, recipient_id, recipient_phone, api_last_fetch_at,
        apx_last_fetch_at, api_success, api_message, api_current_state_id,
        api_current_state_desc, api_current_city, api_current_state_at, payment_code,
        payment_desc, amount_total, amount_declared, amount_to_collect, gestion_count
      )
      SELECT
        tracking_number, datetime('now'), created_at, updated_at, scanned_at, scanned_by,
        delivery_type, zone_id, status_id, management_id, office_status, notes,
        obs_1, obs_2, obs_3, client_name, client_phone, checkout_date, checkout_by,
        message_sent, recipient_name, recipient_id, recipient_phone, api_last_fetch_at,
        apx_last_fetch_at, api_success, api_message, api_current_state_id,
        api_current_state_desc, api_current_city, api_current_state_at, payment_code,
        payment_desc, amount_total, amount_declared, amount_to_collect, gestion_count
      FROM shipments
      WHERE scanned_at <= datetime('now', '-30 days')
    `;

    const result = db.prepare(archiveSql).run();
    const archivedCount = result.changes;

    if (archivedCount > 0) {
      db.prepare("DELETE FROM shipments WHERE scanned_at <= datetime('now', '-30 days')").run();
    }

    db.exec("COMMIT;");

    return {
      success: true,
      archived_count: archivedCount,
    };
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
};
