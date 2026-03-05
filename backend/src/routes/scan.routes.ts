import { Router, Request, Response, NextFunction } from "express";
import { run, get, all } from "../db/index.js";

const router = Router();

// Estados válidos para oficina
const VALID_OFFICE_STATES = [
  "PAQUETE_INGRESADO",
  "PAQUETE_CARGADO",
  "EN_TRANSITO",
  "REINTENTO_1",
  "REINTENTO_2",
  "EN_OFICINA_DIA_1",
  "EN_OFICINA_DIA_2",
  "EN_OFICINA_DIA_3",
  "EN_OFICINA_DIA_4",
  "DEVUELTO",
  "PENDIENTE_CONSULTA",
  "ANOMALIA_DATOS",
];

const VALID_DELIVERY_TYPES = ["LOCAL", "ZONA"];
const JOB_TYPES = ["FETCH_PAYMENT_API", "FETCH_PORTAL_APX"];

interface ScanRequest {
  trackingNumber?: unknown;
  deliveryType?: unknown;
  zoneId?: unknown;
  scannedBy?: unknown;
  officeStatus?: unknown;
}

// Validar y castear entrada
function validateScanInput(body: ScanRequest) {
  const errors: string[] = [];

  // trackingNumber
  if (typeof body.trackingNumber !== "string") {
    errors.push("trackingNumber must be a string");
  } else if (!/^\d{10,15}$/.test(body.trackingNumber)) {
    errors.push("trackingNumber must be 10-15 digits only");
  }

  // deliveryType
  if (typeof body.deliveryType !== "string") {
    errors.push("deliveryType must be a string");
  } else if (!VALID_DELIVERY_TYPES.includes(body.deliveryType)) {
    errors.push(`deliveryType must be one of: ${VALID_DELIVERY_TYPES.join(", ")}`);
  }

  // zoneId (opcional, null o number positivo)
  if (body.zoneId !== null && body.zoneId !== undefined) {
    if (typeof body.zoneId !== "number" || body.zoneId < 0 || !Number.isInteger(body.zoneId)) {
      errors.push("zoneId must be null or a positive integer");
    }
  }

  // scannedBy (string no vacío)
  if (typeof body.scannedBy !== "string" || body.scannedBy.trim() === "") {
    errors.push("scannedBy must be a non-empty string");
  }

  // officeStatus (opcional, validar si se proporciona)
  if (body.officeStatus !== undefined && body.officeStatus !== null) {
    if (typeof body.officeStatus !== "string") {
      errors.push("officeStatus must be a string");
    } else if (!VALID_OFFICE_STATES.includes(body.officeStatus)) {
      errors.push(`officeStatus must be one of: ${VALID_OFFICE_STATES.join(", ")}`);
    }
  }

  return errors;
}

// POST /scan - Escanear guía con validación fuerte
router.post("/", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { trackingNumber, deliveryType, zoneId, scannedBy, officeStatus } = req.body;

    // Validar entrada
    const errors = validateScanInput(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: "Validation failed", details: errors });
    }

    const now = new Date().toISOString();
    const status = officeStatus || "PAQUETE_INGRESADO";

    // Verificar si tracking ya existe
    const existing = get<{ tracking_number: string; scanned_by: string }>(
      "SELECT tracking_number, scanned_by FROM shipments WHERE tracking_number = :trackingNumber",
      { trackingNumber }
    );

    if (existing) {
      // Actualizar: update updated_at y opcionalmente scanned_by
      run(
        `UPDATE shipments SET 
          updated_at = :now,
          scanned_by = :scannedBy,
          office_status = :status
        WHERE tracking_number = :trackingNumber`,
        {
          now,
          scannedBy,
          status,
          trackingNumber,
        }
      );

      return res.json({
        ok: true,
        trackingNumber,
        action: "updated",
        message: "Shipment already existed, updated",
      });
    }

    // INSERT nueva guía
    run(
      `
      INSERT INTO shipments (
        tracking_number,
        created_at,
        updated_at,
        scanned_at,
        scanned_by,
        delivery_type,
        zone_id,
        office_status
      ) VALUES (
        :trackingNumber,
        :now,
        :now,
        :now,
        :scannedBy,
        :deliveryType,
        :zoneId,
        :status
      )
      `,
      {
        trackingNumber,
        now,
        scannedBy,
        deliveryType,
        zoneId: zoneId ?? null,
        status,
      }
    );

    // Crear jobs de forma idempotente
    // Verificar si ya existe algún job PENDING/RUNNING para esta guía
    for (const jobType of JOB_TYPES) {
      const existingJob = get(
        `SELECT id FROM jobs 
         WHERE tracking_number = :trackingNumber 
         AND type = :type 
         AND status IN ('PENDING', 'RUNNING')`,
        { trackingNumber, type: jobType }
      );

      // Solo crear si no existe un job activo del mismo tipo
      if (!existingJob) {
        run(
          `
          INSERT INTO jobs (type, tracking_number, status, run_after, created_at, updated_at)
          VALUES (:type, :trackingNumber, 'PENDING', :now, :now, :now)
          `,
          {
            type: jobType,
            trackingNumber,
            now,
          }
        );
      }
    }

    res.json({
      ok: true,
      trackingNumber,
      action: "created",
      message: "Shipment scanned and jobs enqueued",
    });
  } catch (e) {
    next(e);
  }
});

// GET /scan/pending - Ver guías pendientes de procesar (útil para debug)
router.get("/pending", (_req: Request, res: Response, next: NextFunction) => {
  try {
    const pending = all(
      `SELECT s.*, 
              COUNT(j.id) as pending_jobs
       FROM shipments s
       LEFT JOIN jobs j ON s.tracking_number = j.tracking_number AND j.status IN ('PENDING', 'RUNNING')
       WHERE j.id IS NOT NULL
       GROUP BY s.tracking_number
       ORDER BY s.scanned_at DESC
       LIMIT 50`
    );

    res.json(pending);
  } catch (e) {
    next(e);
  }
});

export default router;
