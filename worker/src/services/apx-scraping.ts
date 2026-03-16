import type { Page } from "playwright";
import {
  FLOW_TABLE_SELECTOR,
  RECIPIENT_NAME_SELECTORS,
  RECIPIENT_PHONE_SELECTORS,
} from "./apx-constants.js";
import type { TrackingFlowRow } from "./apx-types.js";
import { logger } from "./logger.js";

export async function readFirstNonEmpty(page: Page, selectors: string[]): Promise<string | undefined> {
  for (const selector of selectors) {
    const value = await page
      .evaluate((sel) => {
        const el = document.querySelector(sel) as
          | HTMLInputElement
          | HTMLTextAreaElement
          | HTMLElement
          | null;

        if (!el) return null;

        const candidates = [
          "value" in el ? el.value : "",
          el.getAttribute("value") || "",
          el.getAttribute("title") || "",
          el.textContent || "",
          "innerText" in el ? (el as HTMLElement).innerText || "" : "",
        ];

        for (const candidate of candidates) {
          const cleaned = candidate.replace(/\u00a0/g, " ").trim();
          if (cleaned.length > 0) {
            return cleaned;
          }
        }

        return null;
      }, selector)
      .catch(() => null);

    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

export async function scrapeRecipientInfo(page: Page): Promise<{
  recipientName?: string;
  recipientPhone?: string;
}> {
  const timeoutMs = 12000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const [recipientName, recipientPhone] = await Promise.all([
      readFirstNonEmpty(page, RECIPIENT_NAME_SELECTORS),
      readFirstNonEmpty(page, RECIPIENT_PHONE_SELECTORS),
    ]);

    if (recipientName || recipientPhone) {
      return { recipientName, recipientPhone };
    }

    await page.waitForTimeout(500);
  }

  return {
    recipientName: await readFirstNonEmpty(page, RECIPIENT_NAME_SELECTORS),
    recipientPhone: await readFirstNonEmpty(page, RECIPIENT_PHONE_SELECTORS),
  };
}

export async function scrapeFlowTable(page: Page): Promise<TrackingFlowRow[]> {
  const rows: TrackingFlowRow[] = [];

  try {
    await page.waitForSelector(FLOW_TABLE_SELECTOR, { timeout: 10000 });
    const rowElements = await page.$$(`${FLOW_TABLE_SELECTOR} tr:not(:first-child)`);

    for (const row of rowElements) {
      const cells = await row.$$("td");
      if (cells.length < 11) continue;

      const hasLocationIcon = (await cells[0].$('input[type="image"]')) !== null;

      const getText = async (cell: any): Promise<string> => {
        const text = await cell.textContent();
        return (text || "").replace(/\u00a0/g, " ").trim();
      };

      rows.push({
        has_location_icon: hasLocationIcon,
        ciudad: await getText(cells[1]),
        descripcion_estado: await getText(cells[2]),
        fecha_cambio_estado: await getText(cells[3]),
        bodega: await getText(cells[4]),
        motivo: await getText(cells[5]),
        mensajero: await getText(cells[6]),
        numero_tipo_impreso: await getText(cells[7]),
        descripcion_tipo_impreso: await getText(cells[8]),
        usuario: await getText(cells[9]),
        observacion: await getText(cells[10]),
      });
    }
  } catch (error) {
    logger.error("[APX] Error scraping flow table:", error);
  }

  return rows;
}

export function calculateGestionCount(rows: TrackingFlowRow[]): number {
  let count = 0;

  for (const row of rows) {
    const ciudadMatch = row.ciudad.toUpperCase().includes("URRAO");
    const estadoMatch =
      row.descripcion_estado.toUpperCase().includes("DEVOLUCIÃƒâ€œN") ||
      row.descripcion_estado.toUpperCase().includes("DEVOLUCION");
    const fechaValid = row.fecha_cambio_estado.trim().length > 0;

    if (ciudadMatch && estadoMatch && fechaValid) {
      count++;
    }
  }

  return count;
}
