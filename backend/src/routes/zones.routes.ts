import { Router, Request, Response, NextFunction } from "express";
import { run, get, all } from "../db/index.js";

const router = Router();

interface Zone {
  id: number;
  name: string;
  active: number;
  created_at: string;
}

// GET /zones - Listar zonas con filtro opcional
router.get("/", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { active } = req.query;

    let sql = "SELECT id, name, active, created_at FROM zones";
    const params: Record<string, any> = {};

    // Filtro opcional
    if (active !== undefined) {
      const activeValue = String(active) === "1" ? 1 : 0;
      sql += " WHERE active = :active";
      params[":active"] = activeValue;
    }

    sql += " ORDER BY name ASC";

    const zones = all<Zone>(sql, params);

    res.json({
      ok: true,
      count: zones.length,
      zones,
    });
  } catch (e) {
    next(e);
  }
});

// GET /zones/:id - Obtener una zona específica
router.get("/:id", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Validar que sea número
    const zoneId = parseInt(id, 10);
    if (isNaN(zoneId) || zoneId <= 0) {
      return res.status(400).json({ error: "Zone ID must be a positive integer" });
    }

    const zone = get<Zone>("SELECT id, name, active, created_at FROM zones WHERE id = :id", {
      ":id": zoneId,
    });

    if (!zone) {
      return res.status(404).json({ error: "Zone not found" });
    }

    res.json({ ok: true, zone });
  } catch (e) {
    next(e);
  }
});

// POST /zones - Crear zona
router.post("/", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body;

    // Validación
    const errors: string[] = [];

    if (typeof name !== "string") {
      errors.push("name must be a string");
    } else if (name.trim().length === 0) {
      errors.push("name cannot be empty");
    } else if (name.length > 100) {
      errors.push("name must be 100 characters or less");
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: "Validation failed", details: errors });
    }

    const trimmedName = name.trim();
    const now = new Date().toISOString();

    // Verificar si ya existe
    const existing = get("SELECT id FROM zones WHERE name = :name", { ":name": trimmedName });
    if (existing) {
      return res.status(409).json({ error: "Zone with this name already exists" });
    }

    // Insertar
    run(
      `
      INSERT INTO zones (name, active, created_at)
      VALUES (:name, 1, :now)
      `,
      { ":name": trimmedName, ":now": now }
    );

    // Obtener el que se creó (aproximado, buscamos por name)
    const newZone = get<Zone>("SELECT id, name, active, created_at FROM zones WHERE name = :name", {
      ":name": trimmedName,
    });

    res.status(201).json({
      ok: true,
      message: "Zone created",
      zone: newZone,
    });
  } catch (e) {
    next(e);
  }
});

// PATCH /zones/:id - Actualizar zona
router.patch("/:id", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, active } = req.body;

    // Validar ID
    const zoneId = parseInt(id, 10);
    if (isNaN(zoneId) || zoneId <= 0) {
      return res.status(400).json({ error: "Zone ID must be a positive integer" });
    }

    // Validación de campos a actualizar
    const errors: string[] = [];
    const updates: Record<string, any> = {};

    if (name !== undefined) {
      if (typeof name !== "string") {
        errors.push("name must be a string");
      } else if (name.trim().length === 0) {
        errors.push("name cannot be empty");
      } else if (name.length > 100) {
        errors.push("name must be 100 characters or less");
      } else {
        updates.name = name.trim();
      }
    }

    if (active !== undefined) {
      if (typeof active !== "boolean" && active !== 0 && active !== 1) {
        errors.push("active must be a boolean or 0/1");
      } else {
        updates.active = active === true || active === 1 ? 1 : 0;
      }
    }

    if (Object.keys(updates).length === 0 && errors.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: "Validation failed", details: errors });
    }

    // Verificar que existe
    const existing = get<Zone>("SELECT id, name FROM zones WHERE id = :id", { ":id": zoneId });
    if (!existing) {
      return res.status(404).json({ error: "Zone not found" });
    }

    // Si se actualiza name, verificar que no esté duplicado
    if (updates.name && updates.name !== existing.name) {
      const duplicate = get("SELECT id FROM zones WHERE name = :name AND id != :id", {
        ":name": updates.name,
        ":id": zoneId,
      });
      if (duplicate) {
        return res.status(409).json({ error: "Zone with this name already exists" });
      }
    }

    // Construir UPDATE dinámico
    const updateFields: string[] = [];
    const params: Record<string, any> = { ":id": zoneId };

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

    // Obtener zona actualizada
    const updated = get<Zone>("SELECT id, name, active, created_at FROM zones WHERE id = :id", {
      ":id": zoneId,
    });

    res.json({
      ok: true,
      message: "Zone updated",
      zone: updated,
    });
  } catch (e) {
    next(e);
  }
});

// DELETE /zones/:id - Eliminar zona
router.delete("/:id", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID format" });

    const existing = get<Zone>("SELECT id, name FROM zones WHERE id = :id", { ":id": id });
    if (!existing) {
      return res.status(404).json({ error: "Zone not found" });
    }

    // Aquí podríamos validar si hay guías atadas a la zona, 
    // pero como el modelo es libre, procederemos a borrar.
    run("DELETE FROM zones WHERE id = :id", { ":id": id });

    res.json({ ok: true, message: "Zone deleted" });
  } catch (e) {
    next(e);
  }
});

export default router;
