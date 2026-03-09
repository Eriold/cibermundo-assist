import { Router, Request, Response, NextFunction } from "express";
import { run, get, all } from "../db/index.js";

const router = Router();

router.get("/", (req: Request, res: Response, next: NextFunction) => {
  try {
    const statuses = all("SELECT * FROM statuses ORDER BY id ASC");
    res.json(statuses);
  } catch (e) {
    next(e);
  }
});

router.post("/", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });

    const existing = get("SELECT id FROM statuses WHERE name = :name", { ":name": name.trim() });
    if (existing) return res.status(409).json({ error: "Ese estado ya existe" });

    run("INSERT INTO statuses (name, active, created_at) VALUES (:name, 1, datetime('now'))", { ":name": name.trim() });
    res.status(201).json({ ok: true, message: "Estado creado" });
  } catch (e) {
    next(e);
  }
});

router.patch("/:id", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { active } = req.body;

    if (isNaN(id) || active === undefined) return res.status(400).json({ error: "Invalid data" });

    const existing = get("SELECT id FROM statuses WHERE id = :id", { ":id": id });
    if (!existing) return res.status(404).json({ error: "Not found" });

    run("UPDATE statuses SET active = :active WHERE id = :id", { ":id": id, ":active": active ? 1 : 0 });
    res.json({ ok: true, message: "Estado actualizado" });
  } catch (e) {
    next(e);
  }
});

export default router;
