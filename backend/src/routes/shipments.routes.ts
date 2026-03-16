import { Router, Request, Response, NextFunction } from "express";
import {
  deleteShipment,
  exportShipments,
  getGestionSummary,
  getJobsByTracking,
  getShipmentByTracking,
  getTrackingHistory,
  listShipments,
  type Scope,
  enqueueGestionReload,
  retryFailedPaymentJobs,
  updateShipment,
} from "../services/shipments.service.js";

const router = Router();

function parseScope(value: unknown): Scope {
  return value === "closed" ? "closed" : "open";
}

router.get("/", (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = listShipments({
      page: parseInt((req.query.page as string) || "1", 10),
      limit: parseInt((req.query.limit as string) || "20", 10),
      scope: parseScope(req.query.scope),
      search: req.query.search as string | undefined,
      zoneId: req.query.zoneId as string | undefined,
      managementId: req.query.managementId as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      checkoutDateFrom: req.query.checkoutDateFrom as string | undefined,
      checkoutDateTo: req.query.checkoutDateTo as string | undefined,
    });

    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.post("/retry-payment-failures", (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(retryFailedPaymentJobs());
  } catch (e) {
    next(e);
  }
});

router.get("/:trackingNumber", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { trackingNumber } = req.params;
    if (trackingNumber === "export" || trackingNumber === "gestion-summary") {
      return next();
    }

    const row = getShipmentByTracking(trackingNumber);
    if (!row) {
      return res.status(404).json({ error: "Shipment not found" });
    }

    res.json(row);
  } catch (e) {
    next(e);
  }
});

router.get("/:trackingNumber/jobs", (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(getJobsByTracking(req.params.trackingNumber));
  } catch (e) {
    next(e);
  }
});

router.get("/export", (req: Request, res: Response, next: NextFunction) => {
  try {
    const csv = exportShipments({
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      status: req.query.status as string | undefined,
      zoneId: req.query.zoneId as string | undefined,
      deliveryType: req.query.deliveryType as string | undefined,
    });

    const timestamp = new Date().toISOString().split("T")[0];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="shipments-${timestamp}.csv"`);
    res.send(csv);
  } catch (e) {
    next(e);
  }
});

router.post("/load-gestiones", (req: Request, res: Response, next: NextFunction) => {
  try {
    const forceReload = req.query.force === "true" || req.body?.force === true;
    res.json(enqueueGestionReload(forceReload));
  } catch (e) {
    next(e);
  }
});

router.get("/gestion-summary", (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(getGestionSummary(parseScope(req.query.scope)));
  } catch (e) {
    next(e);
  }
});

router.get("/:trackingNumber/tracking", (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(getTrackingHistory(req.params.trackingNumber));
  } catch (e) {
    next(e);
  }
});

router.patch("/:trackingNumber", (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = updateShipment(req.params.trackingNumber, req.body);
    if (result.status >= 400) {
      return res.status(result.status).json(result.body);
    }

    res.json(result.body);
  } catch (e) {
    next(e);
  }
});

router.delete("/:trackingNumber", (req: Request, res: Response, next: NextFunction) => {
  try {
    const recordSource = req.query.recordSource === "archive" ? "archive" : "active";
    const result = deleteShipment(req.params.trackingNumber, recordSource);
    if (!result) {
      return res.status(404).json({ error: "Guia no encontrada" });
    }

    res.json(result);
  } catch (e) {
    next(e);
  }
});

export default router;
