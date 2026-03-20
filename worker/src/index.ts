import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __filename2 = fileURLToPath(import.meta.url);
const __dirname2 = path.dirname(__filename2);

const workerEnvPath = path.resolve(__dirname2, "../.env");
const rootEnvPath = path.resolve(__dirname2, "../../.env");

if (fs.existsSync(workerEnvPath)) {
  dotenv.config({ path: workerEnvPath });
} else if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}

import { initDb, getDbPath } from "./db/index.js";
import { checkInternet } from "./services/internet.js";
import { getJobStats, processOnePaymentJob, processFetchPortalApx } from "./services/jobs.js";
import paymentWeb from "./services/paymentWeb.js";
import apxClient from "./services/apx-client.js";
import { get } from "./db/index.js";
import { logger } from "./services/logger.js";

const POLL_INTERVAL = parseInt(process.env.WORKER_POLL_MS || process.env.POLL_INTERVAL || "5000", 10);
const INTERNET_CHECK_INTERVAL = parseInt(process.env.INTERNET_CHECK_INTERVAL || "30000", 10);
const MAX_JOB_ATTEMPTS = parseInt(process.env.MAX_JOB_ATTEMPTS || "3", 10);
const PAYMENT_WEB_DELAY_MIN = parseInt(process.env.PAYMENT_WEB_DELAY_MIN || "1500", 10);
const PAYMENT_WEB_DELAY_MAX = parseInt(process.env.PAYMENT_WEB_DELAY_MAX || "3500", 10);
const ENABLE_APX_SCRAPER = process.env.ENABLE_APX_SCRAPER === "true";

let isOnline = false;
let lastInternetCheck = 0;
let lastArchiveCheck = 0;
let isProcessing = false;

function randomDelay(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

async function checkInternetPeriodically(): Promise<void> {
  const now = Date.now();
  if (now - lastInternetCheck < INTERNET_CHECK_INTERVAL) {
    return;
  }

  lastInternetCheck = now;
  const wasOnline = isOnline;
  isOnline = await checkInternet();

  if (isOnline && !wasOnline) {
    logger.info("Internet conectado");
  } else if (!isOnline && wasOnline) {
    logger.warn("Internet desconectado");
  }
}

async function archiveOldShipmentsPeriodically(): Promise<void> {
  const now = Date.now();
  if (now - lastArchiveCheck < 86400000) {
    return;
  }

  lastArchiveCheck = now;
  try {
    const backendPort = process.env.BACKEND_PORT || "4010";
    const res = await fetch(`http://localhost:${backendPort}/admin/archive`, {
      method: "POST",
    });
    const data = await res.json();
    if (data.success && data.archived_count > 0) {
      logger.info(`Archival job: movidos ${data.archived_count} envios antiguos a shipments_archive.`);
    }
  } catch (err) {
    logger.error("Failed to run archival job:", err);
  }
}

async function processPendingJobs(): Promise<void> {
  if (isProcessing) {
    return;
  }

  isProcessing = true;

  try {
    await checkInternetPeriodically();
    await archiveOldShipmentsPeriodically();

    const stats = getJobStats();
    logger.debug(`[POLL] Total jobs: ${stats.totalCount} | FETCH_PAYMENT_API PENDING: ${stats.paymentPendingCount}`);

    const jobProcessed = await processOnePaymentJob(MAX_JOB_ATTEMPTS);
    if (jobProcessed) {
      const delay = randomDelay(PAYMENT_WEB_DELAY_MIN, PAYMENT_WEB_DELAY_MAX);
      logger.debug(`Delaying ${Math.round(delay)}ms before next payment web request...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (ENABLE_APX_SCRAPER) {
      await processOneApxJob();
    }
  } catch (error) {
    logger.error("Error in processPendingJobs:", error);
  } finally {
    isProcessing = false;
  }
}

async function processOneApxJob(): Promise<void> {
  const now = new Date().toISOString();
  const job = get<any>(
    `SELECT j.*
     FROM jobs j
     LEFT JOIN shipments s ON s.tracking_number = j.tracking_number
     WHERE j.status = 'PENDING'
       AND j.type = 'FETCH_PORTAL_APX'
       AND (j.run_after IS NULL OR j.run_after <= ?)
       AND (
         s.api_last_fetch_at IS NOT NULL
         OR EXISTS (
           SELECT 1
           FROM jobs payment_done
           WHERE payment_done.tracking_number = j.tracking_number
             AND payment_done.type = 'FETCH_PAYMENT_API'
             AND payment_done.status = 'DONE'
         )
       )
       AND NOT EXISTS (
         SELECT 1
         FROM jobs payment_active
         WHERE payment_active.tracking_number = j.tracking_number
           AND payment_active.type = 'FETCH_PAYMENT_API'
           AND payment_active.status IN ('PENDING', 'RUNNING', 'WAITING_NET')
       )
     ORDER BY j.id ASC
     LIMIT 1`,
    [now] as any
  );

  if (!job) return;

  logger.debug(`[WORKER] Processing APX job id=${job.id} guide=${job.tracking_number}`);
  await processFetchPortalApx(job);
  await apxClient.waitBetweenScrapes();
}

async function main(): Promise<void> {
  try {
    const dbPath = getDbPath();
    const dbExists = fs.existsSync(dbPath);

    logger.info("Worker iniciando...");
    logger.info(`DB_PATH: ${dbPath}`);
    logger.debug(`DB exists: ${dbExists}`);

    await initDb();
    logger.info("Database initialized");

    await paymentWeb.init();
    logger.info("Playwright browser initialized");

    if (!ENABLE_APX_SCRAPER) {
      logger.warn("APX scraper disabled via ENABLE_APX_SCRAPER=false");
    }

    await checkInternetPeriodically();
    setInterval(processPendingJobs, POLL_INTERVAL);
    await processPendingJobs();

    logger.info(`Worker loop started (poll every ${POLL_INTERVAL}ms)`);

    process.on("SIGINT", async () => {
      logger.info("Shutting down gracefully...");
      await paymentWeb.close();
      await apxClient.close();
      logger.info("Playwright browsers closed");
      process.exit(0);
    });
  } catch (error) {
    logger.error("Fatal error:", error);
    await paymentWeb.close();
    process.exit(1);
  }
}

main();
