import { Router, Request, Response, NextFunction } from "express";
import {
  createZone,
  deleteZone,
  getZoneById,
  listZones,
  parseAndValidateZoneId,
  updateZone,
} from "../services/zones.service.js";

const router = Router();

router.get("/", (req: Request, res: Response, next: NextFunction) => {
  try {
    const activeQuery = typeof req.query.active === "string"
      ? req.query.active
      : Array.isArray(req.query.active)
        ? req.query.active.filter((value): value is string => typeof value === "string")
        : undefined;
    const { count, zones } = listZones(activeQuery);

    res.json({
      ok: true,
      count,
      zones,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { zoneId, error } = parseAndValidateZoneId(req.params.id);
    if (!zoneId) {
      return res.status(400).json({ error });
    }

    const zone = getZoneById(zoneId);
    if (!zone) {
      return res.status(404).json({ error: "Zone not found" });
    }

    res.json({ ok: true, zone });
  } catch (error) {
    next(error);
  }
});

router.post("/", (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = createZone(req.body ?? {});

    if (result.errors.length > 0) {
      if (result.errors.some((error) => error === "Zone with this name already exists")) {
        return res.status(409).json({ error: "Zone with this name already exists" });
      }

      return res.status(400).json({ error: "Validation failed", details: result.errors });
    }

    res.status(201).json({
      ok: true,
      message: "Zone created",
      zone: result.zone,
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { zoneId, error } = parseAndValidateZoneId(req.params.id);
    if (!zoneId) {
      return res.status(400).json({ error });
    }

    const result = updateZone(zoneId, req.body ?? {});

    if (result.notFound) {
      return res.status(404).json({ error: "Zone not found" });
    }

    if (result.errors.length > 0) {
      if (result.errors.some((error) => error === "Zone with this name already exists")) {
        return res.status(409).json({ error: "Zone with this name already exists" });
      }

      if (result.errors.some((error) => error === "No fields to update")) {
        return res.status(400).json({ error: "No fields to update" });
      }

      return res.status(400).json({ error: "Validation failed", details: result.errors });
    }

    res.json({
      ok: true,
      message: "Zone updated",
      zone: result.zone,
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { zoneId } = parseAndValidateZoneId(req.params.id);
    if (!zoneId) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    const result = deleteZone(zoneId);
    if (result.notFound) {
      return res.status(404).json({ error: "Zone not found" });
    }

    res.json({ ok: true, message: "Zone deleted" });
  } catch (error) {
    next(error);
  }
});

export default router;
