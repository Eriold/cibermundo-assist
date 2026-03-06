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

// Obtener todas las guías
router.get("/", (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = all(`
      SELECT s.*, z.name as zone_name 
      FROM shipments s 
      LEFT JOIN zones z ON s.zone_id = z.id 
      ORDER BY s.scanned_at DESC
    `);
    res.json(rows);
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

// PATCH /:trackingNumber - Actualizar número de guía
router.patch("/:trackingNumber", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { trackingNumber } = req.params;
    const { newTrackingNumber } = req.body;

    if (!newTrackingNumber || typeof newTrackingNumber !== "string") {
      return res.status(400).json({ error: "newTrackingNumber is required and must be a string" });
    }

    const trimmedNew = newTrackingNumber.trim();

    if (!/^\d{10,15}$/.test(trimmedNew)) {
      return res.status(400).json({ error: "El nuevo número de guía debe contener solo de 10 a 15 números." });
    }

    // Verificar si el viejo existe
    const existing = get("SELECT tracking_number FROM shipments WHERE tracking_number = :old", { ":old": trackingNumber });
    if (!existing) {
      return res.status(404).json({ error: "Guía original no encontrada" });
    }

    if (trackingNumber === trimmedNew) {
      return res.json({ ok: true, message: "Sin cambios" });
    }

    // Verificar colisión con el nuevo
    const duplicate = get("SELECT tracking_number FROM shipments WHERE tracking_number = :new", { ":new": trimmedNew });
    if (duplicate) {
       return res.status(409).json({ error: "Esta guía ya se encuentra registrada en el sistema. Debes eliminar o editar la guía duplicada original antes de ingresarla aquí." });
    }

    // Update shipments y jobs
    run("UPDATE shipments SET tracking_number = :new WHERE tracking_number = :old", {
      ":old": trackingNumber,
      ":new": trimmedNew
    });

    run("UPDATE jobs SET tracking_number = :new WHERE tracking_number = :old", {
      ":old": trackingNumber,
      ":new": trimmedNew
    });

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
