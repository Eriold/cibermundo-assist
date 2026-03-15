import { all, get, run } from "../db/index.js";

export interface Zone {
  id: number;
  name: string;
  active: number;
  created_at: string;
}

interface ZoneListResult {
  count: number;
  zones: Zone[];
}

interface ZoneMutationPayload {
  active?: boolean | 0 | 1;
  name?: string;
}

const MAX_ZONE_NAME_LENGTH = 100;

const parseZoneId = (rawId: string) => {
  const id = parseInt(rawId, 10);
  if (Number.isNaN(id) || id <= 0) {
    return null;
  }

  return id;
};

const normalizeZoneName = (value: unknown) => {
  if (typeof value !== "string") {
    return { value: null, error: "name must be a string" };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { value: null, error: "name cannot be empty" };
  }

  if (trimmed.length > MAX_ZONE_NAME_LENGTH) {
    return { value: null, error: "name must be 100 characters or less" };
  }

  return { value: trimmed, error: null };
};

const normalizeZoneActive = (value: unknown) => {
  if (typeof value === "boolean") return { value: value ? 1 : 0, error: null };
  if (value === 0 || value === 1) return { value, error: null };
  return { value: null, error: "active must be a boolean or 0/1" };
};

export const parseAndValidateZoneId = (rawId: string) => {
  const zoneId = parseZoneId(rawId);
  if (!zoneId) {
    return { zoneId: null, error: "Zone ID must be a positive integer" };
  }

  return { zoneId, error: null };
};

export const listZones = (active?: string | string[]): ZoneListResult => {
  let sql = "SELECT id, name, active, created_at FROM zones";
  const params: Record<string, unknown> = {};

  if (active !== undefined) {
    const activeValue = String(active) === "1" ? 1 : 0;
    sql += " WHERE active = :active";
    params[":active"] = activeValue;
  }

  sql += " ORDER BY name ASC";

  const zones = all<Zone>(sql, params);
  return { count: zones.length, zones };
};

export const getZoneById = (zoneId: number) =>
  get<Zone>("SELECT id, name, active, created_at FROM zones WHERE id = :id", {
    ":id": zoneId,
  });

export const createZone = (payload: { name?: unknown }) => {
  const errors: string[] = [];
  const normalizedName = normalizeZoneName(payload.name);

  if (normalizedName.error) {
    errors.push(normalizedName.error);
  }

  if (errors.length > 0 || !normalizedName.value) {
    return { errors, zone: null };
  }

  const existing = get("SELECT id FROM zones WHERE name = :name", {
    ":name": normalizedName.value,
  });
  if (existing) {
    return { errors: ["Zone with this name already exists"], zone: null };
  }

  const now = new Date().toISOString();
  run(
    `
    INSERT INTO zones (name, active, created_at)
    VALUES (:name, 1, :now)
    `,
    { ":name": normalizedName.value, ":now": now }
  );

  const zone = get<Zone>("SELECT id, name, active, created_at FROM zones WHERE name = :name", {
    ":name": normalizedName.value,
  });

  return { errors: [], zone };
};

export const updateZone = (zoneId: number, payload: ZoneMutationPayload) => {
  const errors: string[] = [];
  const updates: Record<string, string | number> = {};

  if (payload.name !== undefined) {
    const normalizedName = normalizeZoneName(payload.name);
    if (normalizedName.error) {
      errors.push(normalizedName.error);
    } else if (normalizedName.value) {
      updates.name = normalizedName.value;
    }
  }

  if (payload.active !== undefined) {
    const normalizedActive = normalizeZoneActive(payload.active);
    if (normalizedActive.error) {
      errors.push(normalizedActive.error);
    } else if (normalizedActive.value !== null) {
      updates.active = normalizedActive.value;
    }
  }

  if (Object.keys(updates).length === 0 && errors.length === 0) {
    return { errors: ["No fields to update"], zone: null, notFound: false };
  }

  if (errors.length > 0) {
    return { errors, zone: null, notFound: false };
  }

  const existing = get<Pick<Zone, "id" | "name">>("SELECT id, name FROM zones WHERE id = :id", {
    ":id": zoneId,
  });
  if (!existing) {
    return { errors: [], zone: null, notFound: true };
  }

  if (updates.name && updates.name !== existing.name) {
    const duplicate = get("SELECT id FROM zones WHERE name = :name AND id != :id", {
      ":name": updates.name,
      ":id": zoneId,
    });
    if (duplicate) {
      return { errors: ["Zone with this name already exists"], zone: null, notFound: false };
    }
  }

  const updateFields: string[] = [];
  const params: Record<string, string | number> = { ":id": zoneId };

  if (updates.name) {
    updateFields.push("name = :name");
    params[":name"] = updates.name;
  }

  if (updates.active !== undefined) {
    updateFields.push("active = :active");
    params[":active"] = updates.active;
  }

  if (updateFields.length > 0) {
    run(`UPDATE zones SET ${updateFields.join(", ")} WHERE id = :id`, params);
  }

  const zone = getZoneById(zoneId);
  return { errors: [], zone, notFound: false };
};

export const deleteZone = (zoneId: number) => {
  const existing = get<Pick<Zone, "id" | "name">>("SELECT id, name FROM zones WHERE id = :id", {
    ":id": zoneId,
  });
  if (!existing) {
    return { deleted: false, notFound: true };
  }

  run("DELETE FROM zones WHERE id = :id", { ":id": zoneId });
  return { deleted: true, notFound: false };
};
