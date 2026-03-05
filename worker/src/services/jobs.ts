import { run, get, all, saveDbImmediate } from "../db/index.js";
import { fetchPaymentInfo } from "./payment-api.js";
import { fetchApxData } from "./apx-client.js";
import paymentWeb, { type PaymentWebResponse } from "./paymentWeb.js";

export interface Job {
  id: number;
  type: string;
  tracking_number: string;
  status: string;
  attempts: number;
  max_attempts: number;
  run_after: string;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface Shipment {
  tracking_number: string;
  office_status: string;
  [key: string]: any;
}

/**
 * Helper: verificacion robusta del estado del job
 */
function verifyJobStatus(jobId: number, expectedStatus: string): void {
  const rows = all<{ id: number; status: string; attempts: number; run_after: string | null }>(
    "SELECT id, status, attempts, run_after FROM jobs WHERE id = ? LIMIT 1",
    [jobId] as any
  );
  const check = rows[0];

  if (!check) {
    console.log(`[DEBUG] Job ${jobId} not found after update`);
    console.log("[DEBUG] job row:", check);
    console.log("[DEBUG] jobs snapshot:",
      all<{ id: number; status: string; attempts: number; run_after: string | null }>(
        "SELECT id, status, attempts, run_after FROM jobs ORDER BY id",
        [] as any
      )
    );
    throw new Error(`Job ${jobId} not found after update`);
  }

  if (check.status !== expectedStatus) {
    console.log(`[DEBUG] Status mismatch: expected ${expectedStatus}, got ${check.status}`);
    console.log("[DEBUG] job row:", check);
    console.log("[DEBUG] jobs snapshot:",
      all<{ id: number; status: string; attempts: number; run_after: string | null }>(
        "SELECT id, status, attempts, run_after FROM jobs ORDER BY id",
        [] as any
      )
    );
    throw new Error(`Status mismatch for job ${jobId}: expected ${expectedStatus}, got ${check.status}`);
  }

  console.log(`[JOB] after update id=${check.id} status=${check.status} attempts=${check.attempts} run_after=${check.run_after}`);
}


/**
 * Procesar UN job FETCH_PAYMENT_API
 * 1. SELECT candidatos sin filtro run_after
 * 2. En JS: encontrar primer job elegible (run_after <= now)
 * 3. UPDATE para marcar RUNNING (WHERE id AND status='PENDING')
 * 4. Ejecutar Playwright
 * 5. Si éxito: actualizar shipments y marcar DONE
 *    Si error: reintentar con delays, o marcar FAILED
 */
export async function processOnePaymentJob(maxJobAttempts: number = 3): Promise<boolean> {
  const now = new Date().toISOString();

  // Paso 1: Tomar un job elegible (PENDING + run_after <= now)
  const job = get<Job>(
    `SELECT * FROM jobs
     WHERE status = 'PENDING'
       AND type = 'FETCH_PAYMENT_API'
       AND (run_after IS NULL OR run_after <= ?)
     ORDER BY id ASC
     LIMIT 1`,
    [now] as any
  );

  if (!job) {
    return false; // No hay jobs PENDING elegibles
  }

  const { id, tracking_number, attempts } = job;
  console.log(`[JOB] selected eligible id=${id} run_after=${job.run_after} now=${now}`);

  // Paso 3: Marcar como RUNNING antes de ejecutar Playwright
  run(
    `UPDATE jobs
     SET status = 'RUNNING', updated_at = ?
     WHERE id = ? AND status = 'PENDING'`,
    [now, id] as any
  );
  saveDbImmediate();

  // Verificar claim atomico: si no quedo RUNNING, abortar
  try {
    verifyJobStatus(id, "RUNNING");
  } catch (error) {
    console.log(`[JOB] claim failed id=${id}, aborting`);
    return false;
  }

  try {
    // Asegurar que existe shipment
    ensureShipment(tracking_number);

    // Paso 4: Fetch via Playwright
    const apiData = await paymentWeb.fetch(tracking_number);

    if (!apiData.Success) {
      // Es una anomalia de datos - marcar como DONE sin reintentar
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
      
      // Marcar como DONE
      run(
        `UPDATE jobs SET status = 'DONE', updated_at = ? WHERE id = ?`,
        [nowUpdate, id] as any
      );
      
      // Forzar persistencia inmediata
      saveDbImmediate();
      // Verificar que se guardo con helper robusto
      verifyJobStatus(id, "DONE");
      
      console.log(`[JOB] done id=${id}`);
      return true;
    }

    // Validar estructura
    if (!apiData.Guia || !apiData.TrazaGuia) {
      throw new Error("Missing Guia or TrazaGuia in response");
    }

    const { Guia, TrazaGuia } = apiData;
    const formaPago = Guia.FormasPago?.[0];

    if (!formaPago) {
      throw new Error("No FormasPago in Guia");
    }

    // Calcular amount_to_collect
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

    // Paso 4b: Actualizar shipment
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

    // Paso 5: Marcar job como DONE
    run(
      `UPDATE jobs SET status = 'DONE', updated_at = ? WHERE id = ?`,
      [nowUpdate, id] as any
    );
    
    // Forzar persistencia inmediata
    saveDbImmediate();
    
    // Verificar que se guardo con helper robusto
    verifyJobStatus(id, "DONE");

    console.log(`[JOB] done id=${id}`);
    return true;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const newAttempts = attempts + 1;
    const nowUpdate = new Date().toISOString();

    // Paso 5: Manejar errores con reintentos
    if (newAttempts >= maxJobAttempts) {
      // Máximo de reintentos alcanzado - marcar FAILED
      run(
        `UPDATE jobs SET 
          status = 'FAILED',
          attempts = ?,
          last_error = ?,
          updated_at = ?
         WHERE id = ?`,
        [newAttempts, `${errorMsg} (max retries reached)`, nowUpdate, id] as any
      );
      
      // Forzar persistencia inmediata
      saveDbImmediate();
      
      // Verificar que se guardó con helper robusto
      verifyJobStatus(id, "FAILED");
      
      console.error(`✗ [JOB] id=${id} tracking=${tracking_number} FAILED (attempt ${newAttempts}/${maxJobAttempts}): ${errorMsg}`);
    } else {
      // Reintentar con delay de 30s
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
      
      // Forzar persistencia inmediata
      saveDbImmediate();
      
      // Verificar que se guardó con helper robusto
      verifyJobStatus(id, "PENDING");
      
      console.error(`✗ [JOB] id=${id} tracking=${tracking_number} RETRY (attempt ${newAttempts}/${maxJobAttempts}): ${errorMsg}`);
    }
    return true;
  }
}

/**
 * Obtener jobs pendientes que deben ejecutarse (todos los PENDING/WAITING_NET, sin filtrar run_after)
 */
export function getPendingJobs(): Job[] {
  const jobs = all<Job>(
    `SELECT * FROM jobs 
     WHERE status IN ('PENDING', 'WAITING_NET')
     ORDER BY id ASC
     LIMIT 10`,
    [] as any
  );

  return jobs;
}

/**
 * Obtener estadísticas de jobs
 */
export function getJobStats(): {
  totalCount: number;
  paymentPendingCount: number;
  recentJobs: Array<{
    id: number;
    type: string;
    status: string;
    tracking_number: string;
    run_after: string;
  }>;
} {
  // Todos los jobs
  const allJobs = all<Job>(
    `SELECT * FROM jobs 
     ORDER BY created_at DESC 
     LIMIT 100`,
    [] as any
  );

  // Contar FETCH_PAYMENT_API PENDING
  const paymentPendingCount = allJobs.filter(
    j => j.type === "FETCH_PAYMENT_API" && j.status === "PENDING"
  ).length;

  // Últimos 5 jobs
  const recentJobs = allJobs.slice(0, 5).map(j => ({
    id: j.id,
    type: j.type,
    status: j.status,
    tracking_number: j.tracking_number,
    run_after: j.run_after,
  }));

  return {
    totalCount: allJobs.length,
    paymentPendingCount,
    recentJobs,
  };
}

/**
 * Calcular próximo run_after con backoff: min(60*attempts, 600) segundos
 */
export function calculateNextRunAfter(attempts: number): string {
  // Backoff lineal: 60*attempts segundos, pero máximo 600 segundos (10 minutos)
  const delaySeconds = Math.min(60 * attempts, 600);
  const nextTime = new Date(Date.now() + delaySeconds * 1000);
  return nextTime.toISOString();
}

/**
 * Asegurar que existe un shipment para el tracking_number
 * Si no existe, lo crea con valores mínimos
 */
export function ensureShipment(trackingNumber: string): void {
  const existing = get<{ tracking_number: string }>(
    "SELECT tracking_number FROM shipments WHERE tracking_number = ?",
    [trackingNumber] as any
  );

  if (existing) {
    return;
  }

  const now = new Date().toISOString();
  run(
    `INSERT INTO shipments (
      tracking_number,
      created_at,
      updated_at,
      scanned_at,
      scanned_by,
      delivery_type,
      office_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      trackingNumber,
      now,
      now,
      now,
      "SYSTEM",
      "UNKNOWN",
      "PENDIENTE_CONSULTA",
    ] as any
  );

  console.log(`[SHIPMENT] Created minimal shipment for ${trackingNumber}`);
}

/**
 * Marcar job como RUNNING
 */
export function markJobRunning(jobId: number): void {
  run(
    `UPDATE jobs SET 
      status = 'RUNNING',
      updated_at = ?
     WHERE id = ?`,
    [new Date().toISOString(), jobId] as any
  );
  saveDbImmediate();
  verifyJobStatus(jobId, "RUNNING");
}

/**
 * Marcar job como DONE
 */
export function markJobDone(jobId: number): void {
  run(
    `UPDATE jobs SET 
      status = 'DONE',
      updated_at = ?
     WHERE id = ?`,
    [new Date().toISOString(), jobId] as any
  );
  saveDbImmediate();
  verifyJobStatus(jobId, "DONE");
}

/**
 * Marcar job como FAILED con reintentos
 */
export function markJobFailed(jobId: number, error: string, attempts: number, maxAttempts: number): void {
  const now = new Date().toISOString();

  if (attempts >= maxAttempts) {
    // Máximo de reintentos alcanzado
    run(
      `UPDATE jobs SET 
        status = 'FAILED',
        last_error = ?,
        updated_at = ?
       WHERE id = ?`,
      [`${error} (max retries reached)`, now, jobId] as any
    );
    saveDbImmediate();
    verifyJobStatus(jobId, "FAILED");
  } else {
    // Reintentar con backoff
    const nextRunAfter = calculateNextRunAfter(attempts);
    run(
      `UPDATE jobs SET 
        status = 'WAITING_NET',
        last_error = ?,
        attempts = attempts + 1,
        run_after = ?,
        updated_at = ?
       WHERE id = ?`,
      [error, nextRunAfter, now, jobId] as any
    );
    saveDbImmediate();
    verifyJobStatus(jobId, "WAITING_NET");
  }
}

/**
 * Marcar job como NEEDS_HUMAN (requiere intervención manual, no reintentar)
 */
export function markJobNeedsHuman(jobId: number, reason: string): void {
  const now = new Date().toISOString();
  run(
    `UPDATE jobs SET 
      status = 'NEEDS_HUMAN',
      last_error = ?,
      updated_at = ?
     WHERE id = ?`,
    [reason, now, jobId] as any
  );
}

/**
 * Actualizar shipment a estado ANOMALIA_DATOS
 */
export function markShipmentAnomaly(trackingNumber: string, message: string): void {
  const now = new Date().toISOString();
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

/**
 * Procesar job FETCH_PORTAL_APX
 */
export async function processFetchPortalApx(job: Job): Promise<void> {
  const { id, tracking_number } = job;

  try {
    // Obtener shipment
    const shipment = get<Shipment>(
      "SELECT * FROM shipments WHERE tracking_number = ?",
      [tracking_number] as any
    );

    if (!shipment) {
      throw new Error(`Shipment not found: ${tracking_number}`);
    }

    // Fetch desde APX
    const result = await fetchApxData(tracking_number);

    if (!result.success) {
      // Si requiere intervención humana, marcar como NEEDS_HUMAN
      if (result.needsHuman) {
        markJobNeedsHuman(id, result.error || "Requires human review");
        console.log(`👤 FETCH_PORTAL_APX needs human: ${tracking_number} - ${result.error}`);
      } else {
        // Error normal, reintentar
        throw new Error(result.error || "Unknown APX error");
      }
      return;
    }

    // Procesar respuesta y actualizar shipment
    const { data } = result;
    const now = new Date().toISOString();

    run(
      `UPDATE shipments SET 
        recipient_name = ?,
        recipient_phone = ?,
        recipient_id = ?,
        apx_last_fetch_at = ?,
        updated_at = ?
       WHERE tracking_number = ?`,
      [
        data?.recipient_name || null,
        data?.recipient_phone || null,
        data?.recipient_id || null,
        now,
        now,
        tracking_number,
      ] as any
    );

    // Marcar job como DONE
    markJobDone(id);

    console.log(`✓ FETCH_PORTAL_APX success: ${tracking_number}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    markJobFailed(id, errorMsg, job.attempts, job.max_attempts);
    console.error(`✗ FETCH_PORTAL_APX failed: ${tracking_number}`, errorMsg);
  }
}



/**
 * Dispatcher de jobs según tipo (solo para tipos diferentes a FETCH_PAYMENT_API)
 */
export async function processJob(
  job: Job,
  maxJobAttempts: number = 3,
): Promise<void> {
  const { type } = job;

  switch (type) {
    case "FETCH_PORTAL_APX":
      return processFetchPortalApx(job);

    default:
      console.warn(`Unknown job type: ${type}`);
      markJobFailed(job.id, `Unknown job type: ${type}`, job.attempts, job.max_attempts);
  }
}
