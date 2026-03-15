import { run, saveDbImmediate } from "../db/index.js";
import paymentWeb from "./paymentWeb.js";
import {
  claimJobRunning,
  ensureShipment,
  getEligiblePaymentJob,
} from "./job-store.js";

export async function processOnePaymentJob(maxJobAttempts: number = 3): Promise<boolean> {
  const now = new Date().toISOString();
  const job = getEligiblePaymentJob(now);

  if (!job) return false;

  const { id, tracking_number, attempts } = job;
  console.log(`[JOB] selected eligible id=${id} run_after=${job.run_after} now=${now}`);

  if (!claimJobRunning(id, now)) {
    return false;
  }

  try {
    ensureShipment(tracking_number);

    const apiData = await paymentWeb.fetch(tracking_number);

    if (!apiData.Success) {
      const nowUpdate = new Date().toISOString();
      run(
        `UPDATE shipments SET
          office_status = 'ANOMALIA_DATOS',
          api_message = ?,
          api_success = 0,
          api_last_fetch_at = ?,
          updated_at = ?
         WHERE tracking_number = ?`,
        [apiData.Message || "API returned Success=false", nowUpdate, nowUpdate, tracking_number] as any
      );

      run(`UPDATE jobs SET status = 'DONE', updated_at = ? WHERE id = ?`, [nowUpdate, id] as any);
      saveDbImmediate();

      console.log(`[JOB] done id=${id}`);
      return true;
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
        payment_code = ?,
        payment_desc = ?,
        amount_declared = ?,
        amount_total = ?,
        amount_to_collect = ?,
        api_current_state_desc = ?,
        api_current_city = ?,
        api_current_state_at = ?,
        api_success = 1,
        api_message = ?,
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
        apiData.Message || "OK",
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

    if (newAttempts >= maxJobAttempts) {
      run(
        `UPDATE jobs SET
          status = 'FAILED',
          attempts = ?,
          last_error = ?,
          updated_at = ?
         WHERE id = ?`,
        [newAttempts, `${errorMsg} (max retries reached)`, nowUpdate, id] as any
      );
      saveDbImmediate();
      console.error(
        `× [JOB] id=${id} tracking=${tracking_number} FAILED (attempt ${newAttempts}/${maxJobAttempts}): ${errorMsg}`
      );
    } else {
      const nextRunAfter = new Date(Date.now() + 30000).toISOString();
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
        `× [JOB] id=${id} tracking=${tracking_number} RETRY (attempt ${newAttempts}/${maxJobAttempts}): ${errorMsg}`
      );
    }

    return true;
  }
}
