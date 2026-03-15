import { Router, Request, Response, NextFunction } from "express";
import { archiveOldShipments } from "../services/admin.service.js";

const router = Router();

router.post("/archive", (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = archiveOldShipments();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
