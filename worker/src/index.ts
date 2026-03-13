import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __filename2 = fileURLToPath(import.meta.url);
const __dirname2 = path.dirname(__filename2);

// Intentar cargar .env desde el directorio worker, si no, desde la raíz
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

const POLL_INTERVAL = parseInt(process.env.WORKER_POLL_MS || process.env.POLL_INTERVAL || "5000", 10);
const INTERNET_CHECK_INTERVAL = parseInt(process.env.INTERNET_CHECK_INTERVAL || "30000", 10);
const MAX_JOB_ATTEMPTS = parseInt(process.env.MAX_JOB_ATTEMPTS || "3", 10);
const PAYMENT_API_URL = process.env.PAYMENT_API_URL || "https://www3.interrapidisimo.com/ApiServInter/api/Mensajeria/ObtenerRastreoGuiasClientePost";
const PAYMENT_API_BODY_TEMPLATE = process.env.PAYMENT_API_BODY_TEMPLATE;
const PAYMENT_API_TIMEOUT = parseInt(process.env.PAYMENT_API_TIMEOUT || "10000", 10);
// Aumentado para conexiones lentas: mínimo 1000ms entre requests
const PAYMENT_WEB_DELAY_MIN = parseInt(process.env.PAYMENT_WEB_DELAY_MIN || "1500", 10);
const PAYMENT_WEB_DELAY_MAX = parseInt(process.env.PAYMENT_WEB_DELAY_MAX || "3500", 10);
const ENABLE_APX_SCRAPER = process.env.ENABLE_APX_SCRAPER === "true";

let isOnline = false;
let lastInternetCheck = 0;
let lastArchiveCheck = 0;
let isProcessing = false;

/**
 * Genera delay aleatorio entre min y max ms
 */
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
    console.log("🌐 Internet conectado");
  } else if (!isOnline && wasOnline) {
    console.log("❌ Internet desconectado");
  }
}

async function archiveOldShipmentsPeriodically(): Promise<void> {
  const now = Date.now();
  // Correr una vez cada 24 horas (86400000 ms)
  if (now - lastArchiveCheck < 86400000) {
    return;
  }
  
  lastArchiveCheck = now;
  try {
    const backendPort = process.env.BACKEND_PORT || "3444";
    const res = await fetch(`http://localhost:${backendPort}/admin/archive`, {
      method: 'POST'
    });
    const data = await res.json();
    if (data.success && data.archived_count > 0) {
      console.log(`🧹 Archival Job Run: Movidos ${data.archived_count} envíos antiguos a shipments_archive.`);
    } else {
      console.log(`🧹 Archival Job Run: Sin envíos antiguos que mover.`);
    }
  } catch (err) {
    console.error("⚠️ Failed to run archival job:", err);
  }
}

async function processPendingJobs(): Promise<void> {
  // Evitar concurrencia: si ya está procesando, salir
  if (isProcessing) {
    return;
  }

  isProcessing = true;

  try {
    // Chequear internet y ejecutar depuracion (>30 dias) si toca
    await checkInternetPeriodically();
    await archiveOldShipmentsPeriodically();

    // Obtener estadísticas
    const stats = getJobStats();
    console.log(`\n📊 [POLL] Total jobs: ${stats.totalCount} | FETCH_PAYMENT_API PENDING: ${stats.paymentPendingCount}`);
    if (stats.recentJobs.length > 0) {
      console.log("📋 Last 5 jobs:");
      stats.recentJobs.forEach(j => {
        console.log(`   [${j.id}] ${j.type} ${j.status} ${j.tracking_number} (run_after: ${j.run_after})`);
      });
    }

    // Procesar 1 job FETCH_PAYMENT_API
    const jobProcessed = await processOnePaymentJob(MAX_JOB_ATTEMPTS);

    // Solo agregar delay si realmente procesó un job
    if (jobProcessed) {
      const delay = randomDelay(PAYMENT_WEB_DELAY_MIN, PAYMENT_WEB_DELAY_MAX);
      console.log(`⏳ Delaying ${Math.round(delay)}ms before next payment web request...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Procesar 1 job FETCH_PORTAL_APX solo si está habilitado
    if (ENABLE_APX_SCRAPER) {
      await processOneApxJob();
    }
  } catch (error) {
    console.error("💥 Error in processPendingJobs:", error);
  } finally {
    isProcessing = false;
  }
}

/**
 * Procesar un job FETCH_PORTAL_APX pendiente
 */
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

  console.log(`[WORKER] Processing APX job id=${job.id} guide=${job.tracking_number}`);
  await processFetchPortalApx(job);
  
  // Espera configurable entre scrapes de APX
  await apxClient.waitBetweenScrapes();
}

async function main(): Promise<void> {
  try {
    const dbPath = getDbPath();
    const dbExists = fs.existsSync(dbPath);

    console.log("\n" + "=".repeat(60));
    console.log("✓ Worker iniciando (SLOW NETWORK MODE)...");
    console.log("=".repeat(60));
    console.log(`📍 CWD: ${process.cwd()}`);
    console.log(`💾 DB_PATH: ${dbPath}`);
    console.log(`📂 DB exists: ${dbExists}`);
    console.log(`\nConfig (Slow/Unstable Network):`);
    console.log(`  PAYMENT_API_URL: ${PAYMENT_API_URL}`);
    console.log(`  PAYMENT_API_BODY_TEMPLATE: ${PAYMENT_API_BODY_TEMPLATE || "(default)"}`);
    console.log(`  PAYMENT_API_TIMEOUT: ${PAYMENT_API_TIMEOUT}ms`);
    console.log(`  MAX_JOB_ATTEMPTS: ${MAX_JOB_ATTEMPTS}`);
    console.log(`  POLL_INTERVAL: ${POLL_INTERVAL}ms`);
    console.log(`  PAYMENT_WEB_DELAY: ${PAYMENT_WEB_DELAY_MIN}-${PAYMENT_WEB_DELAY_MAX}ms (increased for stability)`);
    console.log(`  ENABLE_APX_SCRAPER: ${ENABLE_APX_SCRAPER}`);
    console.log(`  Playwright Timeouts: 20s default, 30s navigation`);
    console.log(`  Response Timeout: 20s (with auto-retry on failure)`);
    console.log("=".repeat(60) + "\n");

    // Inicializar BD
    await initDb();
    console.log("✓ Database initialized");

    // Inicializar Playwright
    await paymentWeb.init();
    console.log("✓ Playwright browser initialized (slow network optimized)");

    if (!ENABLE_APX_SCRAPER) {
      console.log("⚠️ APX scraper disabled via ENABLE_APX_SCRAPER=false");
    }

    // Chequeo inicial de internet
    await checkInternetPeriodically();

    // Loop principal
    setInterval(processPendingJobs, POLL_INTERVAL);

    // Ejecutar una vez inmediatamente
    await processPendingJobs();

    console.log(`✓ Worker loop started (poll every ${POLL_INTERVAL}ms)`);

    // Graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\n\n⚠️ Shutting down gracefully...");
      await paymentWeb.close();
      await apxClient.close();
      console.log("✓ Playwright browsers closed");
      process.exit(0);
    });
  } catch (error) {
    console.error("Fatal error:", error);
    await paymentWeb.close();
    process.exit(1);
  }
}

main();
