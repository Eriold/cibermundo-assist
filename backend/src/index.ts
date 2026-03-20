import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { initDb } from "./db/index.js";
import { initSchema } from "./db/schema.js";
import { seedMockShipmentsIfNeeded } from "./db/mock-seed.js";
import { logger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendEnvPath = path.resolve(__dirname, "../.env");
const rootEnvPath = path.resolve(__dirname, "../../.env");
const workerEnvPath = path.resolve(__dirname, "../../worker/.env");

for (const envPath of [backendEnvPath, rootEnvPath, workerEnvPath]) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

const DEFAULT_PORT = 4010;
const PORT = parseInt(process.env.BACKEND_PORT || process.env.PORT || String(DEFAULT_PORT), 10);

async function main() {
  await initDb();
  initSchema();
  seedMockShipmentsIfNeeded();

  const app = createApp();
  const server = app.listen(PORT, () => {
    logger.info(`Backend running on http://localhost:${PORT}`);
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EACCES") {
      logger.error(
        `Cannot bind backend to port ${PORT}. The port may be reserved by Windows or require elevated privileges.`
      );
    } else if (err.code === "EADDRINUSE") {
      logger.error(`Cannot bind backend to port ${PORT}. Another process is already using it.`);
    } else {
      logger.error("Failed to start HTTP server:", err);
    }

    process.exit(1);
  });
}

main().catch((err) => {
  logger.error("Failed to start server:", err);
  process.exit(1);
});
