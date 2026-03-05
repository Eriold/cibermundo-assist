import { Router, Request, Response, NextFunction } from "express";
import { all, get } from "../db/index.js";

const router = Router();

interface Job {
  id: number;
  type: string;
  tracking_number: string;
  status: string;
  attempts: number;
  max_attempts: number;
  run_after: string;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

interface JobSummary {
  status: string;
  type: string;
  count: number;
}

// GET /jobs - Listar jobs con filtros opcionales
router.get("/", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, type, q } = req.query;
    const limit = Math.min(parseInt(String(req.query.limit || "100"), 10), 1000);
    const offset = parseInt(String(req.query.offset || "0"), 10);

    let sql = "SELECT * FROM jobs WHERE 1=1";
    const params: Record<string, any> = {};

    // Filtro: status
    if (status && typeof status === "string" && status.length > 0) {
      sql += " AND status = :status";
      params.status = status;
    }

    // Filtro: type
    if (type && typeof type === "string" && type.length > 0) {
      sql += " AND type = :type";
      params.type = type;
    }

    // Búsqueda: tracking_number (like)
    if (q && typeof q === "string" && q.length > 0) {
      sql += " AND tracking_number LIKE :trackingSearch";
      params.trackingSearch = `%${q}%`;
    }

    sql += " ORDER BY updated_at DESC LIMIT :limit OFFSET :offset";
    params.limit = limit;
    params.offset = offset;

    const jobs = all<Job>(sql, params);

    // Total count (sin límite)
    let countSql = "SELECT COUNT(*) as count FROM jobs WHERE 1=1";
    const countParams: Record<string, any> = {};

    if (status && typeof status === "string" && status.length > 0) {
      countSql += " AND status = :status";
      countParams.status = status;
    }

    if (type && typeof type === "string" && type.length > 0) {
      countSql += " AND type = :type";
      countParams.type = type;
    }

    if (q && typeof q === "string" && q.length > 0) {
      countSql += " AND tracking_number LIKE :trackingSearch";
      countParams.trackingSearch = `%${q}%`;
    }

    const countResult = get<{ count: number }>(countSql, countParams);
    const total = countResult?.count || 0;

    res.json({
      ok: true,
      pagination: {
        total,
        limit,
        offset,
        count: jobs.length,
      },
      jobs,
    });
  } catch (e) {
    next(e);
  }
});

// GET /jobs/summary - Resumen de jobs por status y type
router.get("/summary", (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Contar por status
    const byStatus = all<{ status: string; count: number }>(
      `SELECT status, COUNT(*) as count FROM jobs GROUP BY status ORDER BY status`
    );

    // Contar por type
    const byType = all<{ type: string; count: number }>(
      `SELECT type, COUNT(*) as count FROM jobs GROUP BY type ORDER BY type`
    );

    // Contar por status + type
    const byStatusType = all<{ status: string; type: string; count: number }>(
      `SELECT status, type, COUNT(*) as count FROM jobs GROUP BY status, type ORDER BY status, type`
    );

    // Total general
    const total = get<{ count: number }>("SELECT COUNT(*) as count FROM jobs");

    // Resumen de intentos (max_attempts vs attempts)
    const attemptsInfo = get<{ avg_attempts: number; max_attempts_needed: number }>(
      `SELECT 
        ROUND(AVG(attempts), 1) as avg_attempts,
        COUNT(CASE WHEN attempts >= max_attempts THEN 1 END) as max_attempts_needed
       FROM jobs`
    );

    res.json({
      ok: true,
      total: total?.count || 0,
      byStatus,
      byType,
      byStatusType,
      attempts: {
        average: attemptsInfo?.avg_attempts || 0,
        reachedMaxAttempts: attemptsInfo?.max_attempts_needed || 0,
      },
    });
  } catch (e) {
    next(e);
  }
});

// GET /jobs/:id - Obtener un job específico con shipment relacionado
router.get("/:id", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const jobId = parseInt(id, 10);

    if (isNaN(jobId) || jobId <= 0) {
      return res.status(400).json({ error: "Job ID must be a positive integer" });
    }

    const job = get<Job>(
      "SELECT * FROM jobs WHERE id = :id",
      { id: jobId }
    );

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Obtener shipment relacionado
    const shipment = get(
      "SELECT * FROM shipments WHERE tracking_number = :trackingNumber",
      { trackingNumber: job.tracking_number }
    );

    res.json({
      ok: true,
      job,
      shipment,
    });
  } catch (e) {
    next(e);
  }
});

// GET /jobs/tracking/:trackingNumber - Obtener todos los jobs de una guía
router.get("/tracking/:trackingNumber", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { trackingNumber } = req.params;

    const jobs = all<Job>(
      "SELECT * FROM jobs WHERE tracking_number = :trackingNumber ORDER BY created_at DESC",
      { trackingNumber }
    );

    // Obtener shipment
    const shipment = get(
      "SELECT * FROM shipments WHERE tracking_number = :trackingNumber",
      { trackingNumber }
    );

    res.json({
      ok: true,
      count: jobs.length,
      jobs,
      shipment,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
