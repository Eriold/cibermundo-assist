import { Router, Request, Response, NextFunction } from "express";
import { run, get, all } from "../db/index.js";

const router = Router();

interface TestPaymentRequest {
  trackingNumbers?: unknown;
}

/**
 * POST /test/payment
 * Endpoint temporal para encolar múltiples guías para fetch de datos de pago.
 * Solo inserta en BD, no ejecuta fetch HTTP.
 *
 * Body: { "trackingNumbers": ["700181356595", "240044203655"] }
 * Response: { ok: true, queued: ["700181356595", "240044203655"] }
 */
router.post("/payment", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { trackingNumbers } = req.body as TestPaymentRequest;

    // Validación
    if (!Array.isArray(trackingNumbers)) {
      return res.status(400).json({
        error: "trackingNumbers must be an array of strings",
      });
    }

    const cleaned = trackingNumbers
      .filter((t) => typeof t === "string")
      .map((t) => (t as string).trim())
      .filter(Boolean);

    if (cleaned.length === 0) {
      return res.status(400).json({
        error: "trackingNumbers array cannot be empty",
      });
    }

    // Validar solo dígitos (opcional)
    for (const t of cleaned) {
      if (!/^\d{8,20}$/.test(t)) {
        return res.status(400).json({
          error: `Invalid tracking number: ${t}`,
        });
      }
    }

    const now = new Date().toISOString();
    const queued: string[] = [];

    for (const trackingNumber of cleaned) {
      // 1) Asegurar shipments
      const existing = get<{ tracking_number: string }>(
        "SELECT tracking_number FROM shipments WHERE tracking_number = :trackingNumber",
        { ":trackingNumber": trackingNumber }
      );

      if (!existing) {
        run(
          `
          INSERT INTO shipments (
            tracking_number,
            created_at,
            updated_at,
            scanned_at,
            scanned_by,
            delivery_type,
            office_status
          ) VALUES (
            :trackingNumber,
            :createdAt,
            :updatedAt,
            :scannedAt,
            :scannedBy,
            :deliveryType,
            :officeStatus
          )
          `,
          {
            ":trackingNumber": trackingNumber,
            ":createdAt": now,
            ":updatedAt": now,
            ":scannedAt": now,
            ":scannedBy": "TEST",
            ":deliveryType": "TEST",
            ":officeStatus": "PENDIENTE_CONSULTA",
          }
        );
      } else {
        // Si ya existe, al menos actualiza updated_at
        run(
          `UPDATE shipments SET updated_at = :now WHERE tracking_number = :trackingNumber`,
          { ":now": now, ":trackingNumber": trackingNumber }
        );
      }

      // 2) Evitar jobs duplicados (PENDING/RUNNING)
      const existingJob = get<{ id: number }>(
        `
        SELECT id FROM jobs
        WHERE tracking_number = :trackingNumber
          AND type = 'FETCH_PAYMENT_API'
          AND status IN ('PENDING', 'RUNNING')
        LIMIT 1
        `,
        { ":trackingNumber": trackingNumber }
      );

      if (!existingJob) {
        run(
          `
          INSERT INTO jobs (
            type,
            tracking_number,
            status,
            attempts,
            run_after,
            created_at,
            updated_at
          ) VALUES (
            :type,
            :trackingNumber,
            :status,
            :attempts,
            :runAfter,
            :createdAt,
            :updatedAt
          )
          `,
          {
            ":type": "FETCH_PAYMENT_API",
            ":trackingNumber": trackingNumber,
            ":status": "PENDING",
            ":attempts": 0,
            ":runAfter": now,
            ":createdAt": now,
            ":updatedAt": now,
          }
        );
      }

      queued.push(trackingNumber);
    }

    return res.json({ ok: true, queued });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /test/payment/results
 * Devuelve resultados de últimos fetches de pago
 */
router.get("/payment/results", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const results = all<{
      tracking_number: string;
      payment_desc: string | null;
      amount_to_collect: number | null;
      api_current_state_desc: string | null;
      api_last_fetch_at: string | null;
    }>(
      `
      SELECT
        tracking_number,
        payment_desc,
        amount_to_collect,
        api_current_state_desc,
        api_last_fetch_at
      FROM shipments
      WHERE api_last_fetch_at IS NOT NULL
      ORDER BY api_last_fetch_at DESC
      LIMIT 200
      `
    );

    return res.json(results);
  } catch (e) {
    next(e);
  }
});

export default router;
