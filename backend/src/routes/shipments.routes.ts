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

    // Primero contamos el total para armar UI en React
    let countSql = `SELECT COUNT(*) as count FROM shipments s WHERE ${whereClause}`;
    const countRow = get<{ count: number }>(countSql, search ? { search: params.search } : {});
    const totalCount = countRow ? countRow.count : 0;
    const totalPages = Math.ceil(totalCount / safeLimit);

    // Luego jalamos 1 sola pagina con sus Foraneas resueltas (Zonas, Gestiones y Estados)
    let sql = `
      SELECT s.*, 
             z.name as zone_name,
             st.name as status_name,
             mg.name as management_name,
             u.name as checkout_by_name
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

// DELETE /:trackingNumber - Eliminar guía (y sus jobs)
router.delete("/:trackingNumber", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { trackingNumber } = req.params;

    const existing = get("SELECT tracking_number FROM shipments WHERE tracking_number = :t", { ":t": trackingNumber });
    if (!existing) {
      return res.status(404).json({ error: "Guía no encontrada" });
    }

    run("DELETE FROM shipments WHERE tracking_number = :t", { ":t": trackingNumber });
    run("DELETE FROM jobs WHERE tracking_number = :t", { ":t": trackingNumber });

    res.json({ ok: true, message: "Guía eliminada" });
  } catch (e) {
    next(e);
  }
});

export default router;
