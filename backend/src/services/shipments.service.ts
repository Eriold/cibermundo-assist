import { all, get, run } from "../db/index.js";

export type Scope = "open" | "closed";
export type RecordSource = "active" | "archive";

export interface ShipmentListParams {
  page: number;
  limit: number;
  scope: Scope;
  search?: string;
  zoneId?: string;
  managementId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ShipmentUpdatePayload {
  newTrackingNumber?: string;
  record_source?: RecordSource;
  [key: string]: unknown;
}

function buildShipmentFilters(params: Omit<ShipmentListParams, "page" | "limit" | "scope">, alias: string) {
  const clauses = ["1=1"];
  const sqlParams: Record<string, any> = {};

  if (params.search) {
    clauses.push(`${alias}.tracking_number LIKE :search`);
    sqlParams.search = `%${params.search}%`;
  }

  if (params.zoneId) {
    const zId = parseInt(params.zoneId, 10);
    if (!isNaN(zId) && zId > 0) {
      clauses.push(`${alias}.zone_id = :zoneId`);
      sqlParams.zoneId = zId;
    }
  }

  if (params.managementId) {
    const mId = parseInt(params.managementId, 10);
    if (!isNaN(mId) && mId > 0) {
      clauses.push(`${alias}.management_id = :managementId`);
      sqlParams.managementId = mId;
    }
  }

  if (params.dateFrom) {
    clauses.push(`${alias}.scanned_at >= :dateFrom`);
    sqlParams.dateFrom = params.dateFrom;
  }

  if (params.dateTo) {
    clauses.push(`${alias}.scanned_at <= :dateTo`);
    sqlParams.dateTo = params.dateTo + "T23:59:59.999Z";
  }

  return {
    whereClause: clauses.join(" AND "),
    params: sqlParams,
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

function escapeCSV(value: any): string {
  if (value === null || value === undefined) {
    return "";
  }

  const str = String(value);
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

function generateCSV(data: any[], headers: string[]): string {
  const lines: string[] = [];
  lines.push(headers.map(escapeCSV).join(","));

  for (const row of data) {
    lines.push(headers.map((header) => escapeCSV(row[header])).join(","));
  }

  return lines.join("\n");
}

function getClosedShipmentSelect(whereClause: string) {
  return `
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
  `;
}

export function listShipments(params: ShipmentListParams) {
  const safePage = params.page > 0 ? params.page : 1;
  const safeLimit = params.limit > 0 && params.limit <= 100 ? params.limit : 20;
  const offset = (safePage - 1) * safeLimit;
  const filterInput = {
    search: params.search,
    zoneId: params.zoneId,
    managementId: params.managementId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  };
  const { whereClause, params: filterParams } = buildShipmentFilters(filterInput, "s");

  let totalCount = 0;
  let rows: any[] = [];

  if (params.scope === "open") {
    const queryParams = { ...filterParams, limit: safeLimit, offset };
    const countRow = get<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM shipments s
       LEFT JOIN statuses st ON s.status_id = st.id
       WHERE ${whereClause}
         AND (st.name != 'Cerrado' OR s.status_id IS NULL)`,
      queryParams
    );
    totalCount = countRow ? countRow.count : 0;

    rows = all(
      `SELECT s.*,
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
       LIMIT :limit OFFSET :offset`,
      queryParams
    );
  } else {
    const closedFilters = buildShipmentFilters(filterInput, "base");
    const countParams = { ...closedFilters.params };
    const queryParams = { ...closedFilters.params, limit: safeLimit, offset };

    const countRow = get<{ count: number }>(
      `SELECT COUNT(*) as count
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
       ) base`,
      countParams
    );
    totalCount = countRow ? countRow.count : 0;

    rows = all(
      `${getClosedShipmentSelect(whereClause)}
       ORDER BY base.scanned_at DESC
       LIMIT :limit OFFSET :offset`,
      queryParams
    );
  }

  return {
    data: rows,
    pagination: {
      page: safePage,
      limit: safeLimit,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / safeLimit)),
    },
  };
}

export function getShipmentByTracking(trackingNumber: string) {
  return get(
    "SELECT * FROM shipments WHERE tracking_number = :trackingNumber",
    { trackingNumber }
  );
}

export function getJobsByTracking(trackingNumber: string) {
  return all(
    "SELECT * FROM jobs WHERE tracking_number = :trackingNumber ORDER BY created_at DESC",
    { trackingNumber }
  );
}

export function exportShipments(params: {
  from?: string;
  to?: string;
  status?: string;
  zoneId?: string;
  deliveryType?: string;
}) {
  let sql = "SELECT * FROM shipments WHERE 1=1";
  const sqlParams: Record<string, any> = {};

  if (params.from) {
    sql += " AND scanned_at >= :from";
    sqlParams.from = params.from;
  }
  if (params.to) {
    sql += " AND scanned_at <= :to";
    sqlParams.to = params.to;
  }
  if (params.status) {
    sql += " AND office_status = :status";
    sqlParams.status = params.status;
  }
  if (params.zoneId) {
    const zId = parseInt(params.zoneId, 10);
    if (!isNaN(zId) && zId > 0) {
      sql += " AND zone_id = :zoneId";
      sqlParams.zoneId = zId;
    }
  }
  if (params.deliveryType && ["LOCAL", "ZONA"].includes(params.deliveryType)) {
    sql += " AND delivery_type = :deliveryType";
    sqlParams.deliveryType = params.deliveryType;
  }

  sql += " ORDER BY scanned_at DESC";
  const rows = all(sql, sqlParams);
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

  return generateCSV(rows, headers);
}

export function enqueueGestionReload(forceReload: boolean) {
  const todayStr = new Date().toISOString().split("T")[0];
  const now = new Date().toISOString();
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

  return {
    ok: true,
    message: `Se crearon ${createdCount} jobs de gestion para ${openShipments.length} paquetes abiertos.`,
    total_open: openShipments.length,
    jobs_created: createdCount,
    force_reload: forceReload,
  };
}

export function getGestionSummary(scope: Scope) {
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

  return summary;
}

export function getTrackingHistory(trackingNumber: string) {
  const rows = all(
    `SELECT * FROM shipment_tracking
     WHERE tracking_number = :tn
     ORDER BY id ASC`,
    { ":tn": trackingNumber }
  );

  const shipment = get<{ apx_last_fetch_at: string | null }>(
    `SELECT apx_last_fetch_at FROM shipments WHERE tracking_number = :tn`,
    { ":tn": trackingNumber }
  ) || get<{ apx_last_fetch_at: string | null }>(
    `SELECT apx_last_fetch_at FROM shipments_archive WHERE tracking_number = :tn`,
    { ":tn": trackingNumber }
  );

  return {
    tracking_number: trackingNumber,
    last_updated: shipment?.apx_last_fetch_at || null,
    flow: rows,
  };
}

function updateArchivedShipment(trackingNumber: string, body: ShipmentUpdatePayload) {
  let archiveTracking = trackingNumber;
  const archived = get<any>(
    "SELECT * FROM shipments_archive WHERE tracking_number = :tracking",
    { ":tracking": archiveTracking }
  );

  if (!archived) {
    return { status: 404, body: { error: "Guia archivada no encontrada" } };
  }

  if (body.newTrackingNumber && typeof body.newTrackingNumber === "string") {
    const trimmedNew = body.newTrackingNumber.trim();
    if (!/^\d{4,20}$/.test(trimmedNew)) {
      return { status: 400, body: { error: "El nuevo numero de guia debe contener solo de 4 a 20 numeros." } };
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
        return { status: 409, body: { error: "Esta guia ya se encuentra registrada en el sistema." } };
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
    "amount_total",
  ];
  const updates: string[] = [];
  const params: Record<string, any> = { ":tracking": archiveTracking };

  for (const field of archiveFields) {
    if (body[field] !== undefined) {
      updates.push(`${field} = :${field}`);
      params[`:${field}`] = normalizeUpdateValue(field, body[field]);
    }
  }

  if (updates.length > 0) {
    run(
      `UPDATE shipments_archive SET ${updates.join(", ")} WHERE tracking_number = :tracking`,
      params
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

    return {
      status: 200,
      body: {
        ok: true,
        restored_to_active: true,
        message: "Guia archivada reabierta y movida a activas correctamente",
      },
    };
  }

  return {
    status: 200,
    body: { ok: true, message: "Guia archivada actualizada correctamente" },
  };
}

function updateActiveShipment(trackingNumber: string, body: ShipmentUpdatePayload) {
  let oldTracking = trackingNumber;
  const existing = get(
    "SELECT tracking_number FROM shipments WHERE tracking_number = :old",
    { ":old": oldTracking }
  );
  if (!existing) {
    return { status: 404, body: { error: "Guia original no encontrada" } };
  }

  if (body.newTrackingNumber && typeof body.newTrackingNumber === "string") {
    const trimmedNew = body.newTrackingNumber.trim();
    if (!/^\d{4,20}$/.test(trimmedNew)) {
      return { status: 400, body: { error: "El nuevo numero de guia debe contener solo de 4 a 20 numeros." } };
    }

    if (oldTracking !== trimmedNew) {
      const duplicate = get(
        "SELECT tracking_number FROM shipments WHERE tracking_number = :new",
        { ":new": trimmedNew }
      );
      if (duplicate) {
        return { status: 409, body: { error: "Esta guia ya se encuentra registrada en el sistema." } };
      }

      run("UPDATE shipments SET tracking_number = :new WHERE tracking_number = :old", {
        ":old": oldTracking,
        ":new": trimmedNew,
      });
      run("UPDATE jobs SET tracking_number = :new WHERE tracking_number = :old", {
        ":old": oldTracking,
        ":new": trimmedNew,
      });
      oldTracking = trimmedNew;
    }
  }

  const updatableFields = [
    "client_name", "client_phone",
    "recipient_name", "recipient_phone",
    "obs_1", "obs_2", "obs_3",
    "status_id", "management_id",
    "checkout_date", "checkout_by", "zone_id",
    "amount_total",
  ];
  const updates: string[] = [];
  const params: Record<string, any> = { ":tracking": oldTracking };

  for (const field of updatableFields) {
    if (body[field] !== undefined) {
      updates.push(`${field} = :${field}`);
      params[`:${field}`] = normalizeUpdateValue(field, body[field]);
    }
  }

  if (updates.length > 0) {
    run(`UPDATE shipments SET ${updates.join(", ")} WHERE tracking_number = :tracking`, params);
  }

  return { status: 200, body: { ok: true, message: "Guia actualizada correctamente" } };
}

export function updateShipment(trackingNumber: string, body: ShipmentUpdatePayload) {
  return body.record_source === "archive"
    ? updateArchivedShipment(trackingNumber, body)
    : updateActiveShipment(trackingNumber, body);
}

export function deleteShipment(trackingNumber: string, recordSource: RecordSource) {
  const sourceTable = recordSource === "archive" ? "shipments_archive" : "shipments";
  const existing = get(
    `SELECT tracking_number FROM ${sourceTable} WHERE tracking_number = :t`,
    { ":t": trackingNumber }
  );

  if (!existing) {
    return null;
  }

  run("DELETE FROM shipment_tracking WHERE tracking_number = :t", { ":t": trackingNumber });
  run(`DELETE FROM ${sourceTable} WHERE tracking_number = :t`, { ":t": trackingNumber });
  run("DELETE FROM jobs WHERE tracking_number = :t", { ":t": trackingNumber });

  return { ok: true, message: "Guia eliminada" };
}
