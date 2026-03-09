import "dotenv/config";
import { createApp } from "./app.js";
import { initDb } from "./db/index.js";
import { initSchema } from "./db/schema.js";

const PORT = parseInt(process.env.BACKEND_PORT || process.env.PORT || "3444", 10);

async function main() {
  await initDb();
  initSchema();

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
