import { Router, Request, Response, NextFunction } from "express";
import { all, get } from "../db/index.js";

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
    const rows = all("SELECT * FROM shipments ORDER BY scanned_at DESC");
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

export default router;
