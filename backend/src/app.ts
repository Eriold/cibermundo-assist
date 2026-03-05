import express from "express";
import swaggerUi from "swagger-ui-express";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import scanRoutes from "./routes/scan.routes.js";
import shipmentsRoutes from "./routes/shipments.routes.js";
import zonesRoutes from "./routes/zones.routes.js";
import jobsRoutes from "./routes/jobs.routes.js";
import testRoutes from "./routes/test.routes.js";
import adminRoutes from "./routes/admin.routes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Cargar OpenAPI spec
const openApiSpec = JSON.parse(
  readFileSync(join(__dirname, "../openapi.json"), "utf-8")
);

export function createApp() {
  const app = express();

  app.use(express.json());

  // Swagger UI
  app.use("/docs", swaggerUi.serve);
  app.get("/docs", swaggerUi.setup(openApiSpec, { swaggerOptions: { tryItOutEnabled: true } }));

  // Raw OpenAPI spec
  app.get("/openapi.json", (_req, res) => {
    res.json(openApiSpec);
  });

  app.get("/health", (_, res) => {
    res.json({ ok: true, service: "interrpa-backend" });
  });

  app.use("/scan", scanRoutes);
  app.use("/shipments", shipmentsRoutes);
  app.use("/zones", zonesRoutes);
  app.use("/jobs", jobsRoutes);
  app.use("/test", testRoutes);
  app.use("/admin", adminRoutes);

  return app;
}
