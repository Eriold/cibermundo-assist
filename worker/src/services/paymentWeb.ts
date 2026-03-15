/**
 * Servicio Playwright para scrape de datos de pago via web
 * Singleton: mantiene browser/context/page abiertos entre requests
 */

import { chromium, Browser, BrowserContext, Page } from "playwright";
import {
  PAYMENT_GUIDE_INPUT_SELECTOR,
  PAYMENT_SHIPMENT_URL,
} from "./payment-web-constants.js";
import {
  clearGuideInput,
  registerPaymentPageDebug,
  triggerSearch,
  waitForPaymentResponse,
} from "./payment-web-helpers.js";
import type { PaymentWebResponse } from "./payment-web-types.js";

class PaymentWebSingleton {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  async init(): Promise<void> {
    if (this.browser) {
      console.log("[PAYMENT_PW] Browser already initialized, skipping init");
      return;
    }

    // Leer env var HEADLESS (por defecto true, HEADLESS=false lanza visible)
    const headless = process.env.HEADLESS !== "false";
    console.log("[PAYMENT_PW] Launching browser (headless:", headless, ")");

    this.browser = await chromium.launch({ 
      headless,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--disable-infobars",
        "--no-sandbox",
        "--disable-setuid-sandbox"
      ],
      ignoreDefaultArgs: ["--enable-automation"]
    });
    
    this.context = await this.browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
      javaScriptEnabled: true
    });
    
    this.page = await this.context.newPage();
    registerPaymentPageDebug(this.page);

    // Configurar timeouts globales para conexiones lentas
    this.page.setDefaultTimeout(25000);
    this.page.setDefaultNavigationTimeout(45000);

    console.log("[PAYMENT_PW] Browser initialized with stealth settings");
  }

  async fetch(trackingNumber: string): Promise<PaymentWebResponse> {
    if (!this.page) {
      throw new Error("Browser not initialized. Call init() first.");
    }

    const page = this.page;
    const attemptFetch = async (attemptNum: number): Promise<PaymentWebResponse> => {
      try {
        const currentUrl = page.url();
        if (!currentUrl.startsWith("https://www3.interrapidisimo.com/SiguetuEnvio/shipment")) {
          console.log(`[PAYMENT_PW] Navigating to shipment page (attempt ${attemptNum})...`);
          await page.goto(PAYMENT_SHIPMENT_URL, { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(1000);
        }

        console.log(`[PAYMENT_PW] Waiting for ${PAYMENT_GUIDE_INPUT_SELECTOR} visible (attempt ${attemptNum})...`);
        await page.waitForSelector(PAYMENT_GUIDE_INPUT_SELECTOR, { timeout: 15000 });
        await page.waitForTimeout(500);

        console.log(`[PAYMENT_PW] Filling ${PAYMENT_GUIDE_INPUT_SELECTOR} with ${trackingNumber}`);
        await clearGuideInput(page);
        await page.type(PAYMENT_GUIDE_INPUT_SELECTOR, trackingNumber, { delay: 30 });

        console.log("[PAYMENT_PW] Waiting for API response...");
        const waitForResponsePromise = waitForPaymentResponse(page);

        await triggerSearch(page);

        try {
          const responseJson: PaymentWebResponse = await waitForResponsePromise;
          console.log(`[PAYMENT_PW] Got response Success=${responseJson.Success}`);

          try {
            await clearGuideInput(page);
            console.log("[PAYMENT_PW] Input cleared for next request");
          } catch (cleanupError) {
            console.log("[PAYMENT_PW] Warning: Could not clear input:", cleanupError);
          }

          return responseJson;
        } catch (error) {
          throw error;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(`[PAYMENT_PW] Attempt ${attemptNum} failed: ${errorMsg}`);

        if (attemptNum === 1) {
          console.log("[PAYMENT_PW] Retrying fetch...");
          await page.reload({ waitUntil: "domcontentloaded" });
          return attemptFetch(2);
        }

        // Debug info on final failure
        try {
          await page.screenshot({ path: "payment-fail.png", fullPage: true });
          console.log("[PAYMENT_PW] Failure screenshot saved to payment-fail.png");
        } catch {}

        throw error;
      }
    };

    return await attemptFetch(1);
  }

  async close(): Promise<void> {
    if (this.browser) {
      console.log("[PAYMENT_PW] Closing browser");
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }

  isInitialized(): boolean {
    return this.browser !== null;
  }
}

const paymentWeb = new PaymentWebSingleton();
export default paymentWeb;
export type { PaymentWebResponse };
