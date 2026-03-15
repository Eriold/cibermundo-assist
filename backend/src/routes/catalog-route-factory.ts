import { Router, Request, Response, NextFunction } from "express";
import { all, get, run } from "../db/index.js";

interface NamedCatalogRouteOptions {
  conflictMessage: string;
  createdMessage: string;
  deletedMessage: string;
  emptyNameMessage?: string;
  invalidDataMessage: string;
  invalidIdMessage: string;
  nameRequiredMessage: string;
  notFoundMessage: string;
  tableName: string;
  updatedMessage: string;
}

interface NamedCatalogItem {
  id: number;
  name: string;
  active: number;
  created_at: string;
}

const normalizeName = (value: unknown) => {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  return trimmed;
};

const parseId = (rawId: string) => {
  const id = parseInt(rawId, 10);
  return Number.isNaN(id) ? null : id;
};

const normalizeActive = (value: unknown) => {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value === 0 || value === 1) return value;
  return null;
};

export const createNamedCatalogRouter = ({
  conflictMessage,
  createdMessage,
  deletedMessage,
  emptyNameMessage = "name cannot be empty",
  invalidDataMessage,
  invalidIdMessage,
  nameRequiredMessage,
  notFoundMessage,
  tableName,
  updatedMessage,
}: NamedCatalogRouteOptions) => {
  const router = Router();

  router.get("/", (_req: Request, res: Response, next: NextFunction) => {
    try {
      const items = all<NamedCatalogItem>(`SELECT * FROM ${tableName} ORDER BY id ASC`);
      res.json(items);
    } catch (error) {
      next(error);
    }
  });

  router.post("/", (req: Request, res: Response, next: NextFunction) => {
    try {
      const normalizedName = normalizeName(req.body?.name);
      if (!normalizedName) {
        return res.status(400).json({
          error: typeof req.body?.name === "string" ? emptyNameMessage : nameRequiredMessage,
        });
      }

      const existing = get(`SELECT id FROM ${tableName} WHERE name = :name`, {
        ":name": normalizedName,
      });
      if (existing) {
        return res.status(409).json({ error: conflictMessage });
      }

      run(
        `INSERT INTO ${tableName} (name, active, created_at) VALUES (:name, 1, datetime('now'))`,
        { ":name": normalizedName }
      );

      res.status(201).json({ ok: true, message: createdMessage });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id", (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      if (!id) {
        return res.status(400).json({ error: invalidIdMessage });
      }

      const existing = get<NamedCatalogItem>(
        `SELECT id, name, active, created_at FROM ${tableName} WHERE id = :id`,
        { ":id": id }
      );
      if (!existing) {
        return res.status(404).json({ error: notFoundMessage });
      }

      const updates: string[] = [];
      const params: Record<string, unknown> = { ":id": id };

      if (req.body?.name !== undefined) {
        const normalizedName = normalizeName(req.body.name);
        if (!normalizedName) {
          return res.status(400).json({
            error: typeof req.body.name === "string" ? emptyNameMessage : nameRequiredMessage,
          });
        }

        if (normalizedName !== existing.name) {
          const duplicate = get(`SELECT id FROM ${tableName} WHERE name = :name AND id != :id`, {
            ":name": normalizedName,
            ":id": id,
          });
          if (duplicate) {
            return res.status(409).json({ error: conflictMessage });
          }
        }

        updates.push("name = :name");
        params[":name"] = normalizedName;
      }

      if (req.body?.active !== undefined) {
        const normalizedActive = normalizeActive(req.body.active);
        if (normalizedActive === null) {
          return res.status(400).json({ error: invalidDataMessage });
        }

        updates.push("active = :active");
        params[":active"] = normalizedActive;
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: invalidDataMessage });
      }

      run(`UPDATE ${tableName} SET ${updates.join(", ")} WHERE id = :id`, params);
      res.json({ ok: true, message: updatedMessage });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:id", (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      if (!id) {
        return res.status(400).json({ error: invalidIdMessage });
      }

      const existing = get(`SELECT id FROM ${tableName} WHERE id = :id`, { ":id": id });
      if (!existing) {
        return res.status(404).json({ error: notFoundMessage });
      }

      run(`DELETE FROM ${tableName} WHERE id = :id`, { ":id": id });
      res.json({ ok: true, message: deletedMessage });
    } catch (error) {
      next(error);
    }
  });

  return router;
};
