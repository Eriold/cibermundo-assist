import { Router, Request, Response, NextFunction } from "express";
import {
  authenticateUser,
  createUser,
  deleteUser,
  listUsers,
  updateUser,
} from "../services/users.service.js";

const router = Router();

router.post("/login", (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = authenticateUser(req.body?.username, req.body?.pin);

    if (result.error) {
      const status = result.error === "Invalid credentials" ? 401 : 400;
      return res.status(status).json({ error: result.error });
    }

    return res.json({
      ok: true,
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/", (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { count, users } = listUsers();
    res.json({ ok: true, count, users });
  } catch (error) {
    next(error);
  }
});

router.post("/", (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = createUser(req.body ?? {});
    if (result.error) {
      const status = result.error === "Username already exists" ? 409 : 400;
      return res.status(status).json({ error: result.error });
    }

    res.status(201).json({ ok: true, message: "User created" });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = updateUser(req.params.id, req.body ?? {});

    if (result.error) {
      const status = result.notFound
        ? 404
        : result.error === "Username already assigned to another user"
          ? 409
          : 400;

      return res.status(status).json({ error: result.error });
    }

    res.json({ ok: true, message: "User updated" });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = deleteUser(req.params.id);

    if (result.error) {
      const status = result.forbidden ? 403 : result.notFound ? 404 : 400;
      return res.status(status).json({ error: result.error });
    }

    res.json({ ok: true, message: "User deleted" });
  } catch (error) {
    next(error);
  }
});

export default router;
