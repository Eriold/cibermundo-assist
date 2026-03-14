import { Router, Request, Response, NextFunction } from "express";
import { all, get, run } from "../db/index.js";

const router = Router();

type Scope = "open" | "closed";

function parseScope(value: unknown): Scope {
  return value === "closed" ? "closed" : "open";
}

function buildShipmentFilters(req: Request, alias: string) {
  const clauses = ["1=1"];
  const params: Record<string, any> = {};
  const search = req.query.search as string | undefined;

  if (search) {
    clauses.push(`${alias}.tracking_number LIKE :search`);
    params.search = `%${search}%`;
  }

  if (req.query.zoneId && typeof req.query.zoneId === "string") {
    const zId = parseInt(req.query.zoneId, 10);
    if (!isNaN(zId) && zId > 0) {
      clauses.push(`${alias}.zone_id = :zoneId`);
      params.zoneId = zId;
    }
  }

  if (req.query.managementId && typeof req.query.managementId === "string") {
    const mId = parseInt(req.query.managementId, 10);
    if (!isNaN(mId) && mId > 0) {
      clauses.push(`${alias}.management_id = :managementId`);
      params.managementId = mId;
    }
  }

  if (req.query.dateFrom && typeof req.query.dateFrom === "string") {
    clauses.push(`${alias}.scanned_at >= :dateFrom`);
    params.dateFrom = req.query.dateFrom;
  }

  if (req.query.dateTo && typeof req.query.dateTo === "string") {
    clauses.push(`${alias}.scanned_at <= :dateTo`);
    params.dateTo = req.query.dateTo + "T23:59:59.999Z";
  }

  return {
    whereClause: clauses.join(" AND "),
    params,
  };
}

function normalizeUpdateValue(field: string, value: unknown) {
  if (value === "" && ["status_id", "management_id", "zone_id", "checkout_date", "checkout_by"].includes(field)) {
    return null;
  }
  return value;
}

function enqueueApxJobIfNeeded(trackingNumber: string) {
  const existingJob = get<{ id: number }>(
    `SELECT id FROM jobs
     WHERE tracking_number = :trackingNumber
       AND type = 'FETCH_PORTAL_APX'
       AND status IN ('PENDING', 'RUNNING')
     LIMIT 1`,
    { ":trackingNumber": trackingNumber }
  );

  if (!existingJob) {
    const now = new Date().toISOString();
    run(
      `INSERT INTO jobs (type, tracking_number, status, attempts, max_attempts, run_after, created_at, updated_at)
       VALUES ('FETCH_PORTAL_APX', :trackingNumber, 'PENDING', 0, 3, :now, :now, :now)`,
      { ":trackingNumber": trackingNumber, ":now": now }
    );
  }
}

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
    const scope = parseScope(req.query.scope);

    // Fallbacks de seguridad
    const safePage = page > 0 ? page : 1;
    const safeLimit = limit > 0 && limit <= 100 ? limit : 20;

    const offset = (safePage - 1) * safeLimit;
    const { whereClause, params: filterParams } = buildShipmentFilters(req, "s");

    let countSql = "";
    let sql = "";
    let rows: any[] = [];
    let totalCount = 0;

    if (scope === "open") {
      const params = { ...filterParams, limit: safeLimit, offset };
      countSql = `
        SELECT COUNT(*) as count
        FROM shipments s
        LEFT JOIN statuses st ON s.status_id = st.id
        WHERE ${whereClause}
          AND (st.name != 'Cerrado' OR s.status_id IS NULL)
      `;
      const countRow = get<{ count: number }>(countSql, params);
      totalCount = countRow ? countRow.count : 0;

      sql = `
        SELECT s.*,
               z.name as zone_name,
               st.name as status_name,
               mg.name as management_name,
               COALESCE(u.name, CASE WHEN s.management_id = 2 AND s.checkout_date IS NOT NULL THEN 'E.D.App' END) as checkout_by_name,
               'active' as record_source
        FROM shipments s
        LEFT JOIN zones z ON s.zone_id = z.id
        LEFT JOIN statuses st ON s.status_id = st.id
        LEFT JOIN managements mg ON s.management_id = mg.id
        LEFT JOIN users u ON s.checkout_by = u.id
        WHERE ${whereClause}
          AND (st.name != 'Cerrado' OR s.status_id IS NULL)
        ORDER BY s.scanned_at DESC
        LIMIT :limit OFFSET :offset
      `;
      rows = all(sql, params);
    } else {
      const closedFilters = buildShipmentFilters(req, "base");
      const countParams = { ...closedFilters.params };
      const queryParams = { ...closedFilters.params, limit: safeLimit, offset };

      countSql = `
        SELECT COUNT(*) as count
        FROM (
          SELECT s.tracking_number, s.scanned_at
          FROM shipments s
          LEFT JOIN statuses st ON s.status_id = st.id
          WHERE ${closedFilters.whereClause}
            AND st.name = 'Cerrado'

          UNION ALL

          SELECT a.tracking_number, a.scanned_at
          FROM shipments_archive a
          WHERE ${closedFilters.whereClause.replaceAll("base.", "a.")}
        ) base
      `;
      const countRow = get<{ count: number }>(countSql, countParams);
      totalCount = countRow ? countRow.count : 0;

      sql = `
        SELECT *
        FROM (
          SELECT
            s.tracking_number,
            NULL as archived_at,
            s.created_at,
            s.updated_at,
            s.scanned_at,
            s.scanned_by,
            s.delivery_type,
            s.zone_id,
            s.status_id,
            s.management_id,
            s.office_status,
            s.notes,
            s.obs_1,
            s.obs_2,
            s.obs_3,
            s.client_name,
            s.client_phone,
            s.checkout_date,
            s.checkout_by,
            s.message_sent,
            s.recipient_name,
            s.recipient_id,
            s.recipient_phone,
            s.api_last_fetch_at,
            s.apx_last_fetch_at,
            s.api_success,
            s.api_message,
            s.api_current_state_id,
            s.api_current_state_desc,
            s.api_current_city,
            s.api_current_state_at,
            s.payment_code,
            s.payment_desc,
            s.amount_total,
            s.amount_declared,
            s.amount_to_collect,
            s.gestion_count,
            z.name as zone_name,
            st.name as status_name,
            mg.name as management_name,
            COALESCE(u.name, CASE WHEN s.management_id = 2 AND s.checkout_date IS NOT NULL THEN 'E.D.App' END) as checkout_by_name,
            'active' as record_source
          FROM shipments s
          LEFT JOIN zones z ON s.zone_id = z.id
          LEFT JOIN statuses st ON s.status_id = st.id
          LEFT JOIN managements mg ON s.management_id = mg.id
          LEFT JOIN users u ON s.checkout_by = u.id
          WHERE ${whereClause}
            AND st.name = 'Cerrado'

          UNION ALL

          SELECT
            a.tracking_number,
            a.archived_at,
            a.created_at,
            a.updated_at,
            a.scanned_at,
            a.scanned_by,
            a.delivery_type,
            a.zone_id,
            a.status_id,
            a.management_id,
            a.office_status,
            a.notes,
            a.obs_1,
            a.obs_2,
            a.obs_3,
            a.client_name,
            a.client_phone,
            a.checkout_date,
            a.checkout_by,
            a.message_sent,
            a.recipient_name,
            a.recipient_id,
            a.recipient_phone,
            a.api_last_fetch_at,
            a.apx_last_fetch_at,
            a.api_success,
            a.api_message,
            a.api_current_state_id,
            a.api_current_state_desc,
            a.api_current_city,
            a.api_current_state_at,
            a.payment_code,
            a.payment_desc,
            a.amount_total,
            a.amount_declared,
            a.amount_to_collect,
            a.gestion_count,
            z.name as zone_name,
            st.name as status_name,
            mg.name as management_name,
            COALESCE(u.name, CASE WHEN a.management_id = 2 AND a.checkout_date IS NOT NULL THEN 'E.D.App' END) as checkout_by_name,
            'archive' as record_source
          FROM shipments_archive a
          LEFT JOIN zones z ON a.zone_id = z.id
          LEFT JOIN statuses st ON a.status_id = st.id
          LEFT JOIN managements mg ON a.management_id = mg.id
          LEFT JOIN users u ON a.checkout_by = u.id
          WHERE ${whereClause.replaceAll("s.", "a.")}
        ) base
        ORDER BY base.scanned_at DESC
        LIMIT :limit OFFSET :offset
      `;
      rows = all(sql, queryParams);
    }

    const totalPages = Math.max(1, Math.ceil(totalCount / safeLimit));
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
    const scope = parseScope(req.query.scope);
    const rows = scope === "open"
      ? all<{ gestion_count: number; count: number }>(
          `SELECT COALESCE(s.gestion_count, 0) as gestion_count, COUNT(*) as count
           FROM shipments s
           LEFT JOIN statuses st ON s.status_id = st.id
           WHERE (st.name != 'Cerrado' OR s.status_id IS NULL)
           GROUP BY COALESCE(s.gestion_count, 0)
           ORDER BY gestion_count ASC`
        )
      : all<{ gestion_count: number; count: number }>(
          `SELECT gestion_count, COUNT(*) as count
           FROM (
             SELECT COALESCE(s.gestion_count, 0) as gestion_count
             FROM shipments s
             LEFT JOIN statuses st ON s.status_id = st.id
             WHERE st.name = 'Cerrado'

             UNION ALL

             SELECT COALESCE(a.gestion_count, 0) as gestion_count
             FROM shipments_archive a
           ) grouped
           GROUP BY gestion_count
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
    ) || get<{ apx_last_fetch_at: string | null }>(
      `SELECT apx_last_fetch_at FROM shipments_archive WHERE tracking_number = :tn`,
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

    if (body.record_source === "archive") {
      let archiveTracking = trackingNumber;
      const archived = get<any>(
        "SELECT * FROM shipments_archive WHERE tracking_number = :tracking",
        { ":tracking": archiveTracking }
      );

      if (!archived) {
        return res.status(404).json({ error: "GuÃ­a archivada no encontrada" });
      }

      if (body.newTrackingNumber && typeof body.newTrackingNumber === "string") {
        const trimmedNew = body.newTrackingNumber.trim();

        if (!/^\d{4,20}$/.test(trimmedNew)) {
          return res.status(400).json({ error: "El nuevo nÃºmero de guÃ­a debe contener solo de 4 a 20 nÃºmeros." });
        }

        if (archiveTracking !== trimmedNew) {
          const duplicate = get(
            `SELECT tracking_number FROM shipments WHERE tracking_number = :new
             UNION ALL
             SELECT tracking_number FROM shipments_archive WHERE tracking_number = :new
             LIMIT 1`,
            { ":new": trimmedNew }
          );

          if (duplicate) {
            return res.status(409).json({ error: "Esta guÃ­a ya se encuentra registrada en el sistema." });
          }

          run(
            "UPDATE shipments_archive SET tracking_number = :new WHERE tracking_number = :old",
            { ":old": archiveTracking, ":new": trimmedNew }
          );

          run(
            "UPDATE shipment_tracking SET tracking_number = :new WHERE tracking_number = :old",
            { ":old": archiveTracking, ":new": trimmedNew }
          );

          archiveTracking = trimmedNew;
        }
      }

      const archiveFields = [
        "client_name", "client_phone",
        "recipient_name", "recipient_phone",
        "obs_1", "obs_2", "obs_3",
        "status_id", "management_id",
        "checkout_date", "checkout_by", "zone_id",
        "amount_total"
      ];
      const archiveUpdates: string[] = [];
      const archiveParams: Record<string, any> = { ":tracking": archiveTracking };

      for (const field of archiveFields) {
        if (body[field] !== undefined) {
          archiveUpdates.push(`${field} = :${field}`);
          archiveParams[`:${field}`] = normalizeUpdateValue(field, body[field]);
        }
      }

      if (archiveUpdates.length > 0) {
        run(
          `UPDATE shipments_archive SET ${archiveUpdates.join(", ")} WHERE tracking_number = :tracking`,
          archiveParams
        );
      }

      const updatedArchive = get<any>(
        "SELECT * FROM shipments_archive WHERE tracking_number = :tracking",
        { ":tracking": archiveTracking }
      );

      const shouldRestoreToActive =
        body.status_id !== undefined &&
        updatedArchive &&
        Number(updatedArchive.status_id) !== 2;

      if (shouldRestoreToActive) {
        run(
          `INSERT INTO shipments (
            tracking_number, created_at, updated_at, scanned_at, scanned_by,
            delivery_type, zone_id, status_id, management_id, office_status,
            notes, obs_1, obs_2, obs_3, client_name, client_phone,
            checkout_date, checkout_by, message_sent, recipient_name, recipient_id,
            recipient_phone, api_last_fetch_at, apx_last_fetch_at, api_success,
            api_message, api_current_state_id, api_current_state_desc, api_current_city,
            api_current_state_at, payment_code, payment_desc, amount_total,
            amount_declared, amount_to_collect, gestion_count
          )
          SELECT
            tracking_number, created_at, datetime('now'), scanned_at, scanned_by,
            delivery_type, zone_id, status_id, management_id, office_status,
            notes, obs_1, obs_2, obs_3, client_name, client_phone,
            checkout_date, checkout_by, message_sent, recipient_name, recipient_id,
            recipient_phone, api_last_fetch_at, apx_last_fetch_at, api_success,
            api_message, api_current_state_id, api_current_state_desc, api_current_city,
            api_current_state_at, payment_code, payment_desc, amount_total,
            amount_declared, amount_to_collect, gestion_count
          FROM shipments_archive
          WHERE tracking_number = :tracking`,
          { ":tracking": archiveTracking }
        );

        run(
          "DELETE FROM shipments_archive WHERE tracking_number = :tracking",
          { ":tracking": archiveTracking }
        );

        enqueueApxJobIfNeeded(archiveTracking);

        return res.json({
          ok: true,
          restored_to_active: true,
          message: "GuÃ­a archivada reabierta y movida a activas correctamente",
        });
      }

      return res.json({ ok: true, message: "GuÃ­a archivada actualizada correctamente" });
    }

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
    if (req.query.recordSource === "archive") {
      return next();
    }

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

router.delete("/:trackingNumber", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { trackingNumber } = req.params;
    const recordSource = req.query.recordSource === "archive" ? "archive" : "active";
    if (recordSource !== "archive") {
      return next();
    }
    if (recordSource === "archive") {
      const existingArchived = get(
        "SELECT tracking_number FROM shipments_archive WHERE tracking_number = :t",
        { ":t": trackingNumber }
      );
      if (!existingArchived) {
        return res.status(404).json({ error: "GuÃ­a no encontrada" });
      }

      run("DELETE FROM shipment_tracking WHERE tracking_number = :t", { ":t": trackingNumber });
      run("DELETE FROM shipments_archive WHERE tracking_number = :t", { ":t": trackingNumber });
      run("DELETE FROM jobs WHERE tracking_number = :t", { ":t": trackingNumber });

      return res.json({ ok: true, message: "GuÃ­a eliminada" });
    }
  } catch (e) {
    next(e);
    return;
  }
});

router.delete("/:trackingNumber", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { trackingNumber } = req.params;
    const recordSource = req.query.recordSource === "archive" ? "archive" : "active";
    const sourceTable = recordSource === "archive" ? "shipments_archive" : "shipments";

    const existing = get(
      `SELECT tracking_number FROM ${sourceTable} WHERE tracking_number = :t`,
      { ":t": trackingNumber }
    );
    if (!existing) {
      return next();
    }

    run("DELETE FROM shipment_tracking WHERE tracking_number = :t", { ":t": trackingNumber });
    run(`DELETE FROM ${sourceTable} WHERE tracking_number = :t`, { ":t": trackingNumber });
    run("DELETE FROM jobs WHERE tracking_number = :t", { ":t": trackingNumber });

    return res.json({ ok: true, message: "GuÃ­a eliminada" });
  } catch (e) {
    next(e);
  }
});

export default router;
