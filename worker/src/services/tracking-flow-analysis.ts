import type { TrackingFlowRow } from "./jobs.types.js";

function normalizeText(value: string | null | undefined): string {
  return (value || "")
    .replace(/\u00a0/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function parseApxDateToIso(value: string | null | undefined): string | null {
  const raw = (value || "").replace(/\u00a0/g, " ").trim();
  if (!raw) return null;

  const match = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*([ap])\.\s*m\.$/i
  );

  if (!match) return null;

  const [, dd, mm, yyyy, hh, min, sec, meridiem] = match;
  let hours = Number(hh);

  if (meridiem.toLowerCase() === "p" && hours < 12) hours += 12;
  if (meridiem.toLowerCase() === "a" && hours === 12) hours = 0;

  const date = new Date(
    Number(yyyy),
    Number(mm) - 1,
    Number(dd),
    hours,
    Number(min),
    Number(sec)
  );

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function analyzeTrackingFlow(rows: TrackingFlowRow[]): {
  activeGestionCount: number;
  deliveredFromApp: boolean;
  deliveredAt: string | null;
} {
  let totalGestiones = 0;
  let lastGestionIndex = -1;
  let lastDeliveredIndex = -1;
  let lastDeliveredAt: string | null = null;

  rows.forEach((row, index) => {
    const ciudad = normalizeText(row.ciudad);
    const estado = normalizeText(row.descripcion_estado);
    const observacion = normalizeText(row.observacion);
    const hasDate = (row.fecha_cambio_estado || "").trim().length > 0;

    const isGestion = ciudad.includes("URRAO") && estado.includes("DEVOLUCION") && hasDate;
    if (isGestion) {
      totalGestiones += 1;
      lastGestionIndex = index;
      return;
    }

    const isDelivered =
      estado.includes("ENTREGA EXITOSA") &&
      observacion.includes("ENTREGADO DESDE APP") &&
      hasDate;

    if (isDelivered) {
      lastDeliveredIndex = index;
      lastDeliveredAt = parseApxDateToIso(row.fecha_cambio_estado);
    }
  });

  const deliveredFromApp = lastDeliveredIndex > lastGestionIndex && lastDeliveredIndex !== -1;

  return {
    activeGestionCount: deliveredFromApp ? 0 : totalGestiones,
    deliveredFromApp,
    deliveredAt: deliveredFromApp ? lastDeliveredAt : null,
  };
}
