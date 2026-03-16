import { run, saveDbImmediate } from "../db/index.js";
import paymentWeb from "./paymentWeb.js";
import {
  claimJobRunning,
  ensureShipment,
  getEligiblePaymentJob,
} from "./job-store.js";

const PAYMENT_RETRY_DELAY_MS = 5000;
const PAYMENT_MAX_ATTEMPTS = 4;

function buildFinalTrackingFailureMessage(reason: string): string {
  return `FALLO_RASTREO_FINAL: Fallos en obtener informacion despues de ${PAYMENT_MAX_ATTEMPTS} intentos. ${reason}`;
}

function markShipmentTrackingFailure(trackingNumber: string, message: string, now: string): void {
  run(
    `UPDATE shipments SET
      office_status = 'ANOMALIA_DATOS',
      api_message = ?,
      api_success = 0,
      api_last_fetch_at = ?,
      updated_at = ?
     WHERE tracking_number = ?`,
    [message, now, now, trackingNumber] as any
  );
}

export async function processOnePaymentJob(maxJobAttempts: number = PAYMENT_MAX_ATTEMPTS): Promise<boolean> {
  const now = new Date().toISOString();
  const job = getEligiblePaymentJob(now);

  if (!job) return false;

  const { id, tracking_number, attempts } = job;
  const effectiveMaxAttempts = Math.min(maxJobAttempts, PAYMENT_MAX_ATTEMPTS);
  console.log(`[JOB] selected eligible id=${id} run_after=${job.run_after} now=${now}`);

  if (!claimJobRunning(id, now)) {
    return false;
  }

  try {
    ensureShipment(tracking_number);

    const apiData = await paymentWeb.fetch(tracking_number);

    if (!apiData.Success) {
      throw new Error(apiData.Message || "API returned Success=false");
    }

    if (!apiData.Guia || !apiData.TrazaGuia) {
      throw new Error("Missing Guia or TrazaGuia in response");
    }

    const { Guia, TrazaGuia } = apiData;
    const formaPago = Guia.FormasPago?.[0];
    if (!formaPago) {
      throw new Error("No FormasPago in Guia");
    }

    let amountToCollect = 0;
    switch (formaPago.IdFormaPago) {
      case 1:
        amountToCollect = 0;
        break;
      case 2:
        amountToCollect = Guia.ValorDeclarado || 0;
        break;
      case 3:
        amountToCollect = Guia.ValorTotal || 0;
        break;
    }

    const nowUpdate = new Date().toISOString();
    run(
      `UPDATE shipments SET
        office_status = CASE WHEN office_status = 'ANOMALIA_DATOS' THEN 'PAQUETE_INGRESADO' ELSE office_status END,
        payment_code = ?,
        payment_desc = ?,
        amount_declared = ?,
        amount_total = ?,
        amount_to_collect = ?,
        api_current_state_desc = ?,
        api_current_city = ?,
        api_current_state_at = ?,
        api_success = 1,
        api_message = NULL,
        api_last_fetch_at = ?,
        updated_at = ?
       WHERE tracking_number = ?`,
      [
        formaPago.IdFormaPago,
        formaPago.Descripcion,
        Guia.ValorDeclarado || 0,
        Guia.ValorTotal || 0,
        amountToCollect,
        TrazaGuia.DescripcionEstadoGuia || "PENDIENTE",
        TrazaGuia.Ciudad || "",
        TrazaGuia.FechaGrabacion || nowUpdate,
        nowUpdate,
        nowUpdate,
        tracking_number,
      ] as any
    );

    run(`UPDATE jobs SET status = 'DONE', updated_at = ? WHERE id = ?`, [nowUpdate, id] as any);
    saveDbImmediate();

    console.log(`[JOB] done id=${id}`);
    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const newAttempts = attempts + 1;
    const nowUpdate = new Date().toISOString();

    if (newAttempts >= effectiveMaxAttempts) {
      const finalMessage = buildFinalTrackingFailureMessage(errorMsg);
      markShipmentTrackingFailure(tracking_number, finalMessage, nowUpdate);

      run(
        `UPDATE jobs SET
          status = 'FAILED',
          attempts = ?,
          last_error = ?,
          updated_at = ?
         WHERE id = ?`,
        [newAttempts, finalMessage, nowUpdate, id] as any
      );
      saveDbImmediate();
      console.error(
        `x [JOB] id=${id} tracking=${tracking_number} FAILED (attempt ${newAttempts}/${effectiveMaxAttempts}): ${errorMsg}`
      );
    } else {
      const nextRunAfter = new Date(Date.now() + PAYMENT_RETRY_DELAY_MS).toISOString();
      run(
        `UPDATE jobs SET
          status = 'PENDING',
          attempts = ?,
          last_error = ?,
          run_after = ?,
          updated_at = ?
         WHERE id = ?`,
        [newAttempts, errorMsg, nextRunAfter, nowUpdate, id] as any
      );
      saveDbImmediate();
      console.error(
        `x [JOB] id=${id} tracking=${tracking_number} RETRY (attempt ${newAttempts}/${effectiveMaxAttempts}): ${errorMsg}`
      );
    }

    return true;
  }
}
