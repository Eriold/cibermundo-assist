import { processFetchPortalApx } from "./apx-job-processor.js";
import {
  calculateNextRunAfter,
  ensureShipment,
  getJobStats,
  getPendingJobs,
  markJobDone,
  markJobFailed,
  markJobNeedsHuman,
  markJobRunning,
  markShipmentAnomaly,
} from "./job-store.js";
import { processOnePaymentJob } from "./payment-job-processor.js";
import type { Job, Shipment, TrackingFlowRow } from "./jobs.types.js";

export type { Job, Shipment, TrackingFlowRow };
export {
  calculateNextRunAfter,
  ensureShipment,
  getJobStats,
  getPendingJobs,
  markJobDone,
  markJobFailed,
  markJobNeedsHuman,
  markJobRunning,
  markShipmentAnomaly,
  processFetchPortalApx,
  processOnePaymentJob,
};

export async function processJob(
  job: Job,
  _maxJobAttempts: number = 3,
): Promise<void> {
  switch (job.type) {
    case "FETCH_PORTAL_APX":
      return processFetchPortalApx(job);

    default:
      console.warn(`Unknown job type: ${job.type}`);
      markJobFailed(job.id, `Unknown job type: ${job.type}`, job.attempts, job.max_attempts);
  }
}
