import { all, get, run, saveDbImmediate } from "../db/index.js";
import type { Job } from "./jobs.types.js";

function verifyJobStatus(jobId: number, expectedStatus: string): void {
  const rows = all<{ id: number; status: string; attempts: number; run_after: string | null }>(
    "SELECT id, status, attempts, run_after FROM jobs WHERE id = ? LIMIT 1",
    [jobId] as any
  );
  const check = rows[0];

  if (!check) {
    console.log(`[DEBUG] Job ${jobId} not found after update`);
    console.log("[DEBUG] job row:", check);
    console.log(
      "[DEBUG] jobs snapshot:",
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
    console.log(
      "[DEBUG] jobs snapshot:",
      all<{ id: number; status: string; attempts: number; run_after: string | null }>(
        "SELECT id, status, attempts, run_after FROM jobs ORDER BY id",
        [] as any
      )
    );
    throw new Error(`Status mismatch for job ${jobId}: expected ${expectedStatus}, got ${check.status}`);
  }

  console.log(
    `[JOB] after update id=${check.id} status=${check.status} attempts=${check.attempts} run_after=${check.run_after}`
  );
}

export function getEligiblePaymentJob(now: string): Job | undefined {
  return get<Job>(
    `SELECT * FROM jobs
     WHERE status = 'PENDING'
       AND type = 'FETCH_PAYMENT_API'
       AND (run_after IS NULL OR run_after <= ?)
     ORDER BY id ASC
     LIMIT 1`,
    [now] as any
  );
}

export function getPendingJobs(): Job[] {
  return all<Job>(
    `SELECT * FROM jobs
     WHERE status IN ('PENDING', 'WAITING_NET')
     ORDER BY id ASC
     LIMIT 10`,
    [] as any
  );
}

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
  const allJobs = all<Job>(
    `SELECT * FROM jobs
     ORDER BY created_at DESC
     LIMIT 100`,
    [] as any
  );

  const paymentPendingCount = allJobs.filter(
    (job) => job.type === "FETCH_PAYMENT_API" && job.status === "PENDING"
  ).length;

  const recentJobs = allJobs.slice(0, 5).map((job) => ({
    id: job.id,
    type: job.type,
    status: job.status,
    tracking_number: job.tracking_number,
    run_after: job.run_after,
  }));

  return {
    totalCount: allJobs.length,
    paymentPendingCount,
    recentJobs,
  };
}

export function calculateNextRunAfter(attempts: number): string {
  const delaySeconds = Math.min(60 * attempts, 600);
  return new Date(Date.now() + delaySeconds * 1000).toISOString();
}

export function ensureShipment(trackingNumber: string): void {
  const existing = get<{ tracking_number: string }>(
    "SELECT tracking_number FROM shipments WHERE tracking_number = ?",
    [trackingNumber] as any
  );

  if (existing) return;

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
    [trackingNumber, now, now, now, "SYSTEM", "UNKNOWN", "PENDIENTE_CONSULTA"] as any
  );

  console.log(`[SHIPMENT] Created minimal shipment for ${trackingNumber}`);
}

export function claimJobRunning(jobId: number, now = new Date().toISOString()): boolean {
  run(
    `UPDATE jobs
     SET status = 'RUNNING', updated_at = ?
     WHERE id = ? AND status = 'PENDING'`,
    [now, jobId] as any
  );
  saveDbImmediate();

  try {
    verifyJobStatus(jobId, "RUNNING");
    return true;
  } catch {
    console.log(`[JOB] claim failed id=${jobId}, aborting`);
    return false;
  }
}

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

export function markJobFailed(jobId: number, error: string, attempts: number, maxAttempts: number): void {
  const now = new Date().toISOString();

  if (attempts >= maxAttempts) {
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
    return;
  }

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

export function markJobNeedsHuman(jobId: number, reason: string): void {
  run(
    `UPDATE jobs SET
      status = 'NEEDS_HUMAN',
      last_error = ?,
      updated_at = ?
     WHERE id = ?`,
    [reason, new Date().toISOString(), jobId] as any
  );
}

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
