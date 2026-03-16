import type { Page } from "playwright";
import {
  PAYMENT_API_RESPONSE_URL_PART,
  PAYMENT_FALLBACK_SEARCH_BUTTON_SELECTOR,
  PAYMENT_GUIDE_INPUT_SELECTOR,
  PAYMENT_PRIMARY_SEARCH_BUTTON_SELECTOR,
} from "./payment-web-constants.js";
import type { PaymentWebResponse } from "./payment-web-types.js";
import { isDebugEnabled, logger } from "./logger.js";

export async function clearGuideInput(page: Page): Promise<void> {
  await page.click(PAYMENT_GUIDE_INPUT_SELECTOR);
  await page.keyboard.down("Control");
  await page.keyboard.press("A");
  await page.keyboard.up("Control");
  await page.keyboard.press("Backspace");
}

export async function triggerSearch(page: Page): Promise<void> {
  const attempts: Array<() => Promise<void>> = [
    async () => {
      logger.debug(`[PAYMENT_PW] Clicking ${PAYMENT_PRIMARY_SEARCH_BUTTON_SELECTOR}...`);
      await page.click(PAYMENT_PRIMARY_SEARCH_BUTTON_SELECTOR, { timeout: 4000 });
    },
    async () => {
      logger.debug(`[PAYMENT_PW] Clicking ${PAYMENT_FALLBACK_SEARCH_BUTTON_SELECTOR}...`);
      await page.click(PAYMENT_FALLBACK_SEARCH_BUTTON_SELECTOR, { timeout: 4000 });
    },
    async () => {
      logger.debug(`[PAYMENT_PW] Pressing Enter in ${PAYMENT_GUIDE_INPUT_SELECTOR}...`);
      await page.press(PAYMENT_GUIDE_INPUT_SELECTOR, "Enter");
    },
  ];

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      await attempt();
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not trigger shipment search");
}

export async function waitForPaymentResponse(page: Page): Promise<PaymentWebResponse> {
  const response = await page.waitForResponse(
    (candidate: any) =>
      candidate.url().includes(PAYMENT_API_RESPONSE_URL_PART) &&
      candidate.request().method() === "POST" &&
      candidate.status() === 200,
    { timeout: 30000 }
  );

  return response.json();
}

export function registerPaymentPageDebug(page: Page): void {
  if (!isDebugEnabled()) {
    return;
  }

  page.on("console", (msg) => {
    logger.debug(`[PAYMENT_PW][console] ${msg.type()}: ${msg.text()}`);
  });
  page.on("pageerror", (error) => {
    logger.debug("[PAYMENT_PW][pageerror]", error);
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure();
    logger.debug(
      `[PAYMENT_PW][requestfailed] ${request.method()} ${request.url()} - ${failure?.errorText || "unknown"}`
    );
  });
  page.on("framenavigated", (frame) => {
    logger.debug(`[PAYMENT_PW][framenavigated] ${frame.url()}`);
  });
}
