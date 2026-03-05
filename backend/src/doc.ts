#!/usr/bin/env node

import { spawn } from "child_process";
import { platform } from "os";
import { createApp } from "./app.js";
import { initDb } from "./db/index.js";
import { initSchema } from "./db/schema.js";

const PORT = 3333;
const DOCS_URL = `http://localhost:${PORT}/docs`;

async function main() {
  await initDb();
  initSchema();

  const app = createApp();
  const server = app.listen(PORT, () => {
    console.log("\n" + "=".repeat(70));
    console.log(`✓ Backend running on http://localhost:${PORT}`);
    console.log(`✓ API Docs available at ${DOCS_URL}`);
    console.log(`✓ OpenAPI spec at http://localhost:${PORT}/openapi.json`);
    console.log("=".repeat(70) + "\n");

    // Intentar abrir el navegador automáticamente
    setTimeout(() => {
      openBrowser(DOCS_URL);
    }, 500);
  });

  // Manejar shutdown graceful
  process.on("SIGTERM", () => {
    console.log("\nShutting down gracefully...");
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });
}

function openBrowser(url: string) {
  const isWindows = platform() === "win32";
  const isMac = platform() === "darwin";
  const isLinux = platform() === "linux";

  let command;

  try {
    if (isWindows) {
      command = `start ${url}`;
      spawn("cmd.exe", ["/c", command], { detached: true });
    } else if (isMac) {
      command = `open ${url}`;
      spawn("bash", ["-c", command], { detached: true });
    } else if (isLinux) {
      command = `xdg-open ${url}`;
      spawn("bash", ["-c", command], { detached: true });
    }
  } catch (error) {
    console.warn(`⚠️  Could not open browser automatically. Please visit: ${url}`);
  }
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
