import { Router, Request, Response, NextFunction } from "express";
import { run, get, all } from "../db/index.js";

const router = Router();

interface User {
  id: number;
  name: string;
  username: string;
  pin?: string;
  is_admin: number;
  can_scan: number;
  can_report: number;
  created_at: string;
}

// POST /users/login - Iniciar Sesión con Username y PIN de 4 dígitos
router.post("/login", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, pin } = req.body;

    if (!username || !pin) {
      return res.status(400).json({ error: "Username and PIN are required" });
    }

    const user = get<User>(
      "SELECT id, name, username, is_admin, can_scan, can_report, created_at FROM users WHERE username = :username AND pin = :pin",
      { ":username": username, ":pin": pin }
    );

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Convertimos a booleans en el response visual para frontend
    return res.json({
        ok: true,
        user: {
            id: user.id,
            name: user.name,
            username: user.username,
            roles: {
                isAdmin: user.is_admin === 1,
                canScan: user.can_scan === 1,
                canReport: user.can_report === 1,
            }
        }
    });
  } catch (e) {
    next(e);
  }
});

// GET /users - Listar todos los usuarios (seguro, oculta PIN)
router.get("/", (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = all<User>(
      "SELECT id, name, username, is_admin, can_scan, can_report, created_at FROM users ORDER BY name ASC"
    );

    // Mapeo amigable
    const mapped = users.map(u => ({
        id: u.id,
        name: u.name,
        username: u.username,
        roles: {
            isAdmin: u.is_admin === 1,
            canScan: u.can_scan === 1,
            canReport: u.can_report === 1,
        },
        createdAt: u.created_at
    }));

    res.json({ ok: true, count: mapped.length, users: mapped });
  } catch (e) {
    next(e);
  }
});

// POST /users - Crear Usuario (Solo Admin en teoria)
router.post("/", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, username, pin, roles } = req.body;

    if (!name || !username || !pin) {
      return res.status(400).json({ error: "name, username and pin are required" });
    }

    if (!/^\d{4}$/.test(pin)) {
       return res.status(400).json({ error: "PIN must be exactly 4 digits" });
    }

    // Roles via body: { roles: { isAdmin: true, canScan: true, canReport: false } }
    const isAdmin = roles?.isAdmin ? 1 : 0;
    const canScan = roles?.canScan ? 1 : 0;
    const canReport = roles?.canReport ? 1 : 0;

    const existing = get("SELECT id FROM users WHERE username = :username", { ":username": username.trim() });
    if (existing) {
        return res.status(409).json({ error: "Username already exists" });
    }

    const now = new Date().toISOString();

    run(
      `INSERT INTO users (name, username, pin, is_admin, can_scan, can_report, created_at)
       VALUES (:name, :username, :pin, :isAdmin, :canScan, :canReport, :now)`,
      {
        ":name": name.trim(),
        ":username": username.trim(),
        ":pin": pin,
        ":isAdmin": isAdmin,
        ":canScan": canScan,
        ":canReport": canReport,
        ":now": now
      }
    );

    res.status(201).json({ ok: true, message: "User created" });
  } catch (e) {
    next(e);
  }
});

// PATCH /users/:id - Actualizar Usuario (Solo Administrador, o el usuario mismo su PIN)
router.patch("/:id", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, username, pin, roles } = req.body;

    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID format" });

    const existing = get<User>("SELECT id, username FROM users WHERE id = :id", { ":id": id });
    if (!existing) return res.status(404).json({ error: "User not found" });

    const updates: string[] = [];
    const params: Record<string, any> = { ":id": id };

    if (name) {
        updates.push("name = :name");
        params[":name"] = name.trim();
    }
    
    if (username && username !== existing.username) {
        // Verificar que el nuevo username no lo tenga alguien mas
        const duplicate = get("SELECT id FROM users WHERE username = :username", { ":username": username.trim() });
        if (duplicate) return res.status(409).json({ error: "Username already assigned to another user" });

        updates.push("username = :username");
        params[":username"] = username.trim();
    }

    if (pin) {
        if (!/^\d{4}$/.test(pin)) return res.status(400).json({ error: "PIN must be exactly 4 digits" });
        updates.push("pin = :pin");
        params[":pin"] = pin;
    }

    if (roles) {
        if (roles.isAdmin !== undefined) {
             updates.push("is_admin = :isAdmin");
             params[":isAdmin"] = roles.isAdmin ? 1 : 0;
        }
        if (roles.canScan !== undefined) {
             updates.push("can_scan = :canScan");
             params[":canScan"] = roles.canScan ? 1 : 0;
        }
        if (roles.canReport !== undefined) {
            updates.push("can_report = :canReport");
            params[":canReport"] = roles.canReport ? 1 : 0;
        }
    }

    if (updates.length > 0) {
        run(`UPDATE users SET ${updates.join(", ")} WHERE id = :id`, params);
    }

    res.json({ ok: true, message: "User updated" });
  } catch (e) {
    next(e);
  }
});

// DELETE /users/:id
router.delete("/:id", (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ error: "Invalid ID format" });
    
        // Evitaremos borrar al ADMIN primordial id = 1 para que nunca pierdan acceso
        if (id === 1) {
            return res.status(403).json({ error: "Cannot delete the primary administrator account" });
        }

        const existing = get("SELECT id FROM users WHERE id = :id", { ":id": id });
        if (!existing) return res.status(404).json({ error: "User not found" });
    
        run("DELETE FROM users WHERE id = :id", { ":id": id });
    
        res.json({ ok: true, message: "User deleted" });
      } catch (e) {
        next(e);
      }
});

export default router;
