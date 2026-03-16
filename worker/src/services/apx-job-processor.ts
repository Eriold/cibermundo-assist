import { get, run, saveDbImmediate } from "../db/index.js";
import apxClient from "./apx-client.js";
import {
  markJobDone,
  markJobFailed,
  markJobNeedsHuman,
} from "./job-store.js";
import { analyzeTrackingFlow } from "./tracking-flow-analysis.js";
import type { Job, Shipment, TrackingFlowRow } from "./jobs.types.js";
import { logger } from "./logger.js";

export async function processFetchPortalApx(job: Job): Promise<void> {
  const { id, tracking_number } = job;

  try {
    const shipment = get<Shipment>(
      "SELECT * FROM shipments WHERE tracking_number = ?",
      [tracking_number] as any
    );

    if (!shipment) {
      throw new Error(`Shipment not found: ${tracking_number}`);
    }

    const result = await apxClient.fetchGuideData(tracking_number);

    if (!result.success) {
      if (result.needsHuman) {
        markJobNeedsHuman(id, result.error || "Requires human review");
        logger.warn(`FETCH_PORTAL_APX needs human: ${tracking_number} - ${result.error}`);
      } else {
        throw new Error(result.error || "Unknown APX error");
      }
      return;
    }

    const { data } = result;
    if (!data) {
      throw new Error("APX returned success but no data");
    }

    const now = new Date().toISOString();
    const flowAnalysis = analyzeTrackingFlow(data.tracking_flow as TrackingFlowRow[]);

    run(
      `UPDATE shipments SET
        recipient_name = COALESCE(?, recipient_name),
        recipient_phone = COALESCE(?, recipient_phone),
        gestion_count = ?,
        status_id = CASE WHEN ? THEN 2 ELSE status_id END,
        management_id = CASE WHEN ? THEN 2 ELSE management_id END,
        checkout_date = CASE WHEN ? IS NOT NULL THEN ? ELSE checkout_date END,
        apx_last_fetch_at = ?,
        updated_at = ?
       WHERE tracking_number = ?`,
      [
        data.recipient_name || null,
        data.recipient_phone || null,
        flowAnalysis.activeGestionCount,
        flowAnalysis.deliveredFromApp ? 1 : 0,
        flowAnalysis.deliveredFromApp ? 1 : 0,
        flowAnalysis.deliveredAt,
        flowAnalysis.deliveredAt,
        now,
        now,
        tracking_number,
      ] as any
    );

    run(`DELETE FROM shipment_tracking WHERE tracking_number = ?`, [tracking_number] as any);

    for (const row of data.tracking_flow) {
      run(
        `INSERT INTO shipment_tracking (
          tracking_number, ciudad, descripcion_estado, fecha_cambio_estado,
          bodega, motivo, mensajero, numero_tipo_impreso,
          descripcion_tipo_impreso, usuario, observacion,
          has_location_icon, fetched_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tracking_number,
          row.ciudad,
          row.descripcion_estado,
          row.fecha_cambio_estado,
          row.bodega,
          row.motivo,
          row.mensajero,
          row.numero_tipo_impreso,
          row.descripcion_tipo_impreso,
          row.usuario,
          row.observacion,
          row.has_location_icon ? 1 : 0,
          now,
        ] as any
      );
    }

    saveDbImmediate();
    markJobDone(id);

    logger.debug(
      `FETCH_PORTAL_APX success: ${tracking_number} (${data.tracking_flow.length} rows, ${flowAnalysis.activeGestionCount} gestiones activas${flowAnalysis.deliveredFromApp ? ", entregado desde app" : ""})`
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    markJobFailed(id, errorMsg, job.attempts, job.max_attempts);
    logger.error(`FETCH_PORTAL_APX failed: ${tracking_number}`, errorMsg);
  }
}

export async function waitBetweenApxJobs(): Promise<void> {
  await apxClient.waitBetweenScrapes();
}
