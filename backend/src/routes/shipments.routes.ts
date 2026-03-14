import { Router, Request, Response, NextFunction } from "express";
import { all, get, run } from "../db/index.js";

const router = Router();

// Escapar valor para CSV según RFC 4180
function escapeCSV(value: any): string {
  if (value === null || value === undefined) {
    return "";
  }

  const str = String(value);

  // Si contiene comilla, coma, salto de línea o retorno de carro, envolver en comillas
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    // Escapar comillas internas duplicándolas
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

// Generar CSV desde array de objetos
function generateCSV(data: any[], headers: string[]): string {
  const lines: string[] = [];

  // Header
  lines.push(headers.map(escapeCSV).join(","));

  // Data rows
  for (const row of data) {
    const values = headers.map((header) => escapeCSV(row[header]));
    lines.push(values.join(","));
  }

  return lines.join("\n");
}

// Obtener todas las guías (Paginas)
router.get("/", (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string || "1", 10);
    const limit = parseInt(req.query.limit as string || "20", 10);
    const search = req.query.search as string;

    // Fallbacks de seguridad
    const safePage = page > 0 ? page : 1;
    const safeLimit = limit > 0 && limit <= 100 ? limit : 20;

    const offset = (safePage - 1) * safeLimit;

    let whereClause = "1=1";
    const params: Record<string, any> = { limit: safeLimit, offset: offset };

    if (search) {
      whereClause += " AND s.tracking_number LIKE :search";
      params.search = `%${search}%`;
    }

    if (req.query.zoneId && typeof req.query.zoneId === "string") {
        const zId = parseInt(req.query.zoneId, 10);
        if (!isNaN(zId) && zId > 0) {
            whereClause += " AND s.zone_id = :zoneId";
            params.zoneId = zId;
        }
    }

    if (req.query.managementId && typeof req.query.managementId === "string") {
        const mId = parseInt(req.query.managementId, 10);
        if (!isNaN(mId) && mId > 0) {
            whereClause += " AND s.management_id = :managementId";
            params.managementId = mId;
        }
    }

    if (req.query.dateFrom && typeof req.query.dateFrom === "string") {
        whereClause += " AND s.scanned_at >= :dateFrom";
        params.dateFrom = req.query.dateFrom;
    }

    if (req.query.dateTo && typeof req.query.dateTo === "string") {
        // Asumiendo que viene en formato YYYY-MM-DD, le añadimos horas al final del día por si acaso,
        // o asumimos que el frontend manda ISO completo. Lo trataremos como string literal para comparación de diccionarios sqlite.
        whereClause += " AND s.scanned_at <= :dateTo";
        params.dateTo = req.query.dateTo + "T23:59:59.999Z"; // Acaparar todo el día final
    }

    // Primero contamos el total para armar UI en React
    let countSql = `SELECT COUNT(*) as count FROM shipments s WHERE ${whereClause}`;
    const countRow = get<{ count: number }>(countSql, params);
    const totalCount = countRow ? countRow.count : 0;
    const totalPages = Math.ceil(totalCount / safeLimit);

    // Luego jalamos 1 sola pagina con sus Foraneas resueltas (Zonas, Gestiones y Estados)
    let sql = `
      SELECT s.*, 
             z.name as zone_name,
             st.name as status_name,
             mg.name as management_name,
             COALESCE(u.name, CASE WHEN s.management_id = 2 AND s.checkout_date IS NOT NULL THEN 'E.D.App' END) as checkout_by_name
      FROM shipments s 
      LEFT JOIN zones z ON s.zone_id = z.id
      LEFT JOIN statuses st ON s.status_id = st.id
      LEFT JOIN managements mg ON s.management_id = mg.id
      LEFT JOIN users u ON s.checkout_by = u.id
      WHERE ${whereClause}
      ORDER BY s.scanned_at DESC
      LIMIT :limit OFFSET :offset
    `;
    const rows = all(sql, params);

    res.json({
        data: rows,
        pagination: {
            page: safePage,
            limit: safeLimit,
            totalCount,
            totalPages
        }
    });

  } catch (e) {
    next(e);
  }
});

// Obtener una guía específica
router.get("/:trackingNumber", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { trackingNumber } = req.params;
    if (trackingNumber === "export" || trackingNumber === "gestion-summary") {
      return next();
    }
    const row = get(
      "SELECT * FROM shipments WHERE tracking_number = :trackingNumber",
      { trackingNumber }
    );

    if (!row) {
      return res.status(404).json({ error: "Shipment not found" });
    }

    res.json(row);
  } catch (e) {
    next(e);
  }
});

// Obtener jobs para una guía
router.get("/:trackingNumber/jobs", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { trackingNumber } = req.params;
    const jobs = all(
      "SELECT * FROM jobs WHERE tracking_number = :trackingNumber ORDER BY created_at DESC",
      { trackingNumber }
    );
    res.json(jobs);
  } catch (e) {
    next(e);
  }
});

// GET /export.csv - Exportar a CSV con filtros opcionales
router.get("/export", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, to, status, zoneId, deliveryType } = req.query;

    // Construir query dinámicamente
    let sql = "SELECT * FROM shipments WHERE 1=1";
    const params: Record<string, any> = {};

    // Filtro: from (ISO date)
    if (from && typeof from === "string") {
      sql += " AND scanned_at >= :from";
      params.from = from;
    }

    // Filtro: to (ISO date)
    if (to && typeof to === "string") {
      sql += " AND scanned_at <= :to";
      params.to = to;
    }

    // Filtro: status (office_status)
    if (status && typeof status === "string") {
      sql += " AND office_status = :status";
      params.status = status;
    }

    // Filtro: zoneId
    if (zoneId && typeof zoneId === "string") {
      const zId = parseInt(zoneId, 10);
      if (!isNaN(zId) && zId > 0) {
        sql += " AND zone_id = :zoneId";
        params.zoneId = zId;
      }
    }

    // Filtro: deliveryType
    if (deliveryType && typeof deliveryType === "string") {
      if (["LOCAL", "ZONA"].includes(deliveryType)) {
        sql += " AND delivery_type = :deliveryType";
        params.deliveryType = deliveryType;
      }
    }

    sql += " ORDER BY scanned_at DESC";

    // Ejecutar query
    const rows = all(sql, params);

    // Columnas a exportar
    const headers = [
      "tracking_number",
      "delivery_type",
      "zone_id",
      "office_status",
      "scanned_at",
      "scanned_by",
      "recipient_name",
      "recipient_id",
      "recipient_phone",
      "payment_desc",
      "amount_to_collect",
      "api_current_state_desc",
      "api_current_state_at",
    ];

    // Generar CSV
    const csv = generateCSV(rows, headers);

    // Headers para descarga
    const timestamp = new Date().toISOString().split("T")[0];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="shipments-${timestamp}.csv"`);

    res.send(csv);
  } catch (e) {
    next(e);
  }
});

// ─── GESTIÓN TRACKING ROUTES ──────────────────────────────────

// POST /load-gestiones - Crear jobs FETCH_PORTAL_APX para paquetes abiertos no actualizados hoy
router.post("/load-gestiones", (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD
    const now = new Date().toISOString();
    const forceReload = req.query.force === "true" || req.body?.force === true;

    // Obtener paquetes abiertos (status_id != 2 o NULL) que NO fueron actualizados hoy
    const openShipments = all<{ tracking_number: string }>(
      `SELECT s.tracking_number 
       FROM shipments s
       LEFT JOIN statuses st ON s.status_id = st.id
       WHERE (st.name != 'Cerrado' OR s.status_id IS NULL)
         AND (:forceReload = 1 OR s.apx_last_fetch_at IS NULL OR s.apx_last_fetch_at < :today)`,
      { ":today": todayStr, ":forceReload": forceReload ? 1 : 0 }
    );

    let createdCount = 0;
    for (const ship of openShipments) {
      // Verificar que no hay un job ya PENDING para esta guía
      const existingJob = get<{ id: number }>(
        `SELECT id FROM jobs 
         WHERE tracking_number = :tn 
           AND type = 'FETCH_PORTAL_APX'
           AND status IN ('PENDING', 'RUNNING')
         LIMIT 1`,
        { ":tn": ship.tracking_number }
      );

      if (!existingJob) {
        run(
          `INSERT INTO jobs (type, tracking_number, status, attempts, max_attempts, run_after, created_at, updated_at)
           VALUES ('FETCH_PORTAL_APX', :tn, 'PENDING', 0, 3, :now, :now, :now)`,
          { ":tn": ship.tracking_number, ":now": now }
        );
        createdCount++;
      }
    }

    res.json({
      ok: true,
      message: `Se crearon ${createdCount} jobs de gestión para ${openShipments.length} paquetes abiertos.`,
      total_open: openShipments.length,
      jobs_created: createdCount,
      force_reload: forceReload,
    });
  } catch (e) {
    next(e);
  }
});

// GET /gestion-summary - Retorna conteo agrupado por gestion_count
router.get("/gestion-summary", (req: Request, res: Response, next: NextFunction) => {
  try {
    // Solo paquetes abiertos (no cerrados)
    const rows = all<{ gestion_count: number; count: number }>(
      `SELECT COALESCE(s.gestion_count, 0) as gestion_count, COUNT(*) as count
       FROM shipments s
       LEFT JOIN statuses st ON s.status_id = st.id
       WHERE (st.name != 'Cerrado' OR s.status_id IS NULL)
       GROUP BY COALESCE(s.gestion_count, 0)
       ORDER BY gestion_count ASC`
    );

    const summary: Record<string, number> = {
      gestion_0: 0,
      gestion_1: 0,
      gestion_2: 0,
      gestion_3: 0,
    };

    for (const row of rows) {
      const key = `gestion_${Math.min(row.gestion_count, 3)}`;
      summary[key] = (summary[key] || 0) + row.count;
    }

    res.json(summary);
  } catch (e) {
    next(e);
  }
});

// GET /:trackingNumber/tracking - Retorna historial Flujo Guía
router.get("/:trackingNumber/tracking", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { trackingNumber } = req.params;
    const rows = all(
      `SELECT * FROM shipment_tracking 
       WHERE tracking_number = :tn 
       ORDER BY id ASC`,
      { ":tn": trackingNumber }
    );

    // Obtener la última fecha de actualización
    const shipment = get<{ apx_last_fetch_at: string | null }>(
      `SELECT apx_last_fetch_at FROM shipments WHERE tracking_number = :tn`,
      { ":tn": trackingNumber }
    );

    res.json({
      tracking_number: trackingNumber,
      last_updated: shipment?.apx_last_fetch_at || null,
      flow: rows,
    });
  } catch (e) {
    next(e);
  }
});

// PATCH /:trackingNumber - Actualizar número de guía y/o Detalles (Fase 7)
router.patch("/:trackingNumber", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { trackingNumber } = req.params;
    const body = req.body;
    let oldTracking = trackingNumber;

    // Verificar si el viejo existe
    const existing = get("SELECT tracking_number FROM shipments WHERE tracking_number = :old", { ":old": oldTracking });
    if (!existing) {
      return res.status(404).json({ error: "Guía original no encontrada" });
    }

    // 1. Manejar cambio crítico de tracking_number (LLave Primaria Conceptual y vinculo a Jobs)
    if (body.newTrackingNumber && typeof body.newTrackingNumber === "string") {
      const trimmedNew = body.newTrackingNumber.trim();
      
      if (!/^\d{4,20}$/.test(trimmedNew)) {
        return res.status(400).json({ error: "El nuevo número de guía debe contener solo de 4 a 20 números." });
      }

      if (oldTracking !== trimmedNew) {
         // Verificar colisión con el nuevo
         const duplicate = get("SELECT tracking_number FROM shipments WHERE tracking_number = :new", { ":new": trimmedNew });
         if (duplicate) {
            return res.status(409).json({ error: "Esta guía ya se encuentra registrada en el sistema." });
         }

         run("UPDATE shipments SET tracking_number = :new WHERE tracking_number = :old", {
           ":old": oldTracking,
           ":new": trimmedNew
         });

         run("UPDATE jobs SET tracking_number = :new WHERE tracking_number = :old", {
           ":old": oldTracking,
           ":new": trimmedNew
         });

         oldTracking = trimmedNew; // Actualizamos para el posterior pass de variables de fase 7
      }
    }

    // 2. Manejar actualización de campos dinámicos Fase 7
    const updatableFields = [
      'client_name', 'client_phone', 
      'recipient_name', 'recipient_phone',
      'obs_1', 'obs_2', 'obs_3', 
      'status_id', 'management_id', 
      'checkout_date', 'checkout_by', 'zone_id',
      'amount_total'
    ];

    const updates: string[] = [];
    const params: Record<string, any> = { ":tracking": oldTracking };

    for (const field of updatableFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = :${field}`);
        
        // Manejar strings vacías como NULL para Foreign Keys o fechas
        if (body[field] === "" && ['status_id', 'management_id', 'zone_id', 'checkout_date'].includes(field)) {
             params[`:${field}`] = null;
        } else {
             params[`:${field}`] = body[field];
        }
      }
    }

    if (updates.length > 0) {
      const sql = `UPDATE shipments SET ${updates.join(', ')} WHERE tracking_number = :tracking`;
      run(sql, params);
    }

    res.json({ ok: true, message: "Guía actualizada correctamente" });
  } catch (e) {
    next(e);
  }
});

// DELETE /:trackingNumber - Eliminar guía (y sus jobs + tracking)
router.delete("/:trackingNumber", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { trackingNumber } = req.params;

    const existing = get("SELECT tracking_number FROM shipments WHERE tracking_number = :t", { ":t": trackingNumber });
    if (!existing) {
      return res.status(404).json({ error: "Guía no encontrada" });
    }

    run("DELETE FROM shipment_tracking WHERE tracking_number = :t", { ":t": trackingNumber });
    run("DELETE FROM shipments WHERE tracking_number = :t", { ":t": trackingNumber });
    run("DELETE FROM jobs WHERE tracking_number = :t", { ":t": trackingNumber });

    res.json({ ok: true, message: "Guía eliminada" });
  } catch (e) {
    next(e);
  }
});

export default router;
