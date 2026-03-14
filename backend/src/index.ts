import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { initDb } from "./db/index.js";
import { initSchema } from "./db/schema.js";
import { seedMockShipmentsIfNeeded } from "./db/mock-seed.js";

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

const PORT = parseInt(process.env.BACKEND_PORT || process.env.PORT || "3444", 10);

async function main() {
  await initDb();
  initSchema();
  seedMockShipmentsIfNeeded();

  const app = createApp();
  app.listen(PORT, () => {
    console.log("\n" + "=".repeat(60));
    console.log(`✓ Backend running on http://localhost:${PORT}`);
    console.log("=".repeat(60) + "\n");
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
