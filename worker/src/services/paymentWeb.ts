/**
 * Servicio Playwright para scrape de datos de pago via web
 * Singleton: mantiene browser/context/page abiertos entre requests
 */

import { chromium, Browser, BrowserContext, Page } from "playwright";

interface PaymentWebResponse {
  Success: boolean;
  Message?: string;
  Guia?: {
    FormasPago?: Array<{
      IdFormaPago: number;
      Descripcion: string;
    }>;
    ValorTotal: number;
    ValorDeclarado: number;
  };
  TrazaGuia?: {
    DescripcionEstadoGuia?: string;
    Ciudad?: string;
    FechaGrabacion?: string;
  };
}

class PaymentWebSingleton {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private shipmentUrl = "https://www3.interrapidisimo.com/WebExterno/Consulta/Carga.aspx";
  private headless = true;

  async init(): Promise<void> {
    if (this.browser) {
      console.log("[PAYMENT_PW] Browser already initialized, skipping init");
      return;
    }

    // Leer env var HEADLESS (por defecto true, HEADLESS=false lanza visible)
    const headless = process.env.HEADLESS !== "false";
    console.log("[PAYMENT_PW] headless:", headless);

    this.browser = await chromium.launch({ headless });
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();

    // Listeners de debug para diagnosticar pantalla en blanco
    this.page.on("console", (msg) => {
      console.log(`[PAYMENT_PW][console] ${msg.type()}: ${msg.text()}`);
    });
    this.page.on("pageerror", (error) => {
      console.log("[PAYMENT_PW][pageerror]", error);
    });
    this.page.on("requestfailed", (request) => {
      const failure = request.failure();
      console.log(
        `[PAYMENT_PW][requestfailed] ${request.method()} ${request.url()} - ${failure?.errorText || "unknown"}`
      );
    });
    this.page.on("framenavigated", (frame) => {
      console.log(`[PAYMENT_PW][framenavigated] ${frame.url()}`);
    });

    // Configurar timeouts globales para conexiones lentas
    this.page.setDefaultTimeout(25000);
    this.page.setDefaultNavigationTimeout(45000);

    console.log("[PAYMENT_PW] Browser initialized (slow network mode: timeouts 25s/45s)");
  }

  async fetch(trackingNumber: string): Promise<PaymentWebResponse> {
    if (!this.page) {
      throw new Error("Browser not initialized. Call init() first.");
    }

    const page = this.page; // Capturar en variable local para evitar null checks
    const attemptFetch = async (attemptNum: number): Promise<PaymentWebResponse> => {
      try {
        // Navegar a página si no está ya en la ruta correcta
        const currentUrl = page.url();
        if (!currentUrl.startsWith("https://www3.interrapidisimo.com/SiguetuEnvio/shipment")) {
          console.log(`[PAYMENT_PW] Navigating to shipment page (attempt ${attemptNum})...`);
          console.log(`[PAYMENT_PW] URL before goto: ${page.url()}`);
          try {
            await page.goto("https://www3.interrapidisimo.com/SiguetuEnvio/shipment", { waitUntil: "domcontentloaded" });
            console.log(`[PAYMENT_PW] URL after goto: ${page.url()}`);
            await page.screenshot({ path: "pw-after-goto.png", fullPage: true });
            console.log("[PAYMENT_PW] Screenshot saved to pw-after-goto.png");
          } catch (error) {
            console.error("[PAYMENT_PW] Error during goto:", error);
            throw error;
          }
        }

        // Esperar selector visible
        console.log(`[PAYMENT_PW] Waiting for #inputGuide visible (attempt ${attemptNum})...`);
        try {
          await page.waitForSelector("#inputGuide", { timeout: 10000 });
        } catch (error) {
          console.error("[PAYMENT_PW] Error waiting for #inputGuide:", error);
          throw error;
        }

        // Limpiar y escribir tracking number
        console.log(`[PAYMENT_PW] Filling #inputGuide with ${trackingNumber}`);
        await page.click("#inputGuide");
        await page.keyboard.down("Control");
        await page.keyboard.press("A");
        await page.keyboard.up("Control");
        await page.type("#inputGuide", trackingNumber, { delay: 15 });

        // Crear el waitForResponse BEFORE triggering search
        // Timeout aumentado para conexiones lentas (min 15000ms)
        console.log("[PAYMENT_PW] waiting response (slow network mode)");
        const waitForResponsePromise = page.waitForResponse(
          (response: any) =>
            response.url().includes("ObtenerRastreoGuiasClientePost") &&
            response.request().method() === "POST" &&
            response.status() === 200,
          { timeout: 25000 }
        );

        // Disparar búsqueda con ENTER primero
        console.log("[PAYMENT_PW] Pressing ENTER to search...");
        await page.keyboard.press("Enter");

        // Si en 800ms no hay response, hacer click
        let responseReceived = false;
        const clickTimer = setTimeout(async () => {
          if (!responseReceived) {
            console.log("[PAYMENT_PW] No response after 800ms, clicking search button...");
            try {
              await page.click(".search-button a.right-button", { timeout: 5000 });
            } catch (e) {
              // Ignorar error si no existe el selector
            }
          }
        }, 800);

        try {
          // Esperar la response
          const response = await waitForResponsePromise;
          responseReceived = true;
          clearTimeout(clickTimer);

          const responseJson: PaymentWebResponse = await response.json();
          console.log(`[PAYMENT_PW] got response Success=${responseJson.Success}, Message=${responseJson.Message}`);

          // Limpiar input después de éxito para el siguiente job
          try {
            await page.click("#inputGuide");
            await page.keyboard.down("Control");
            await page.keyboard.press("A");
            await page.keyboard.up("Control");
            await page.keyboard.press("Backspace");
            console.log("[PAYMENT_PW] Input cleared for next request");
          } catch (cleanupError) {
            console.log("[PAYMENT_PW] Warning: Could not clear input:", cleanupError);
          }

          return responseJson;
        } catch (error) {
          clearTimeout(clickTimer);
          throw error;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        
        // Si es timeout y no es el último intento, hacer reload y reintentar
        if (errorMsg.includes("Timeout") && attemptNum === 1) {
          console.log(`[PAYMENT_PW] retry due to slow connection (attempt ${attemptNum}/2)`);
          try {
            console.log("[PAYMENT_PW] Reloading page...");
            await page.reload({ waitUntil: "domcontentloaded" });
            return attemptFetch(2);
          } catch (reloadError) {
            console.error("[PAYMENT_PW] Error during reload/retry:", reloadError);
            throw new Error("Timeout waiting for ObtenerRastreoGuiasClientePost (after retry)");
          }
        }

        // Si es el segundo intento o no es timeout, tomar screenshot y fallar
        if (error instanceof Error && error.message.includes("Timeout")) {
          console.log("[PAYMENT_PW] Timeout waiting for ObtenerRastreoGuiasClientePost");
          try {
            await page.screenshot({ path: "payment-timeout.png", fullPage: true });
            console.log("[PAYMENT_PW] Screenshot saved to payment-timeout.png");
            const pageContent = await page.content();
            console.log("[PAYMENT_PW] Page HTML:", pageContent.substring(0, 1000));
          } catch (debugError) {
            console.error("[PAYMENT_PW] Error capturing debug info:", debugError);
          }
        }

        throw error;
      }
    };

    try {
      return await attemptFetch(1);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[PAYMENT_PW] Error fetching ${trackingNumber}:`, errorMsg);
      throw error;
    }
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

// Singleton instance
const paymentWeb = new PaymentWebSingleton();

export default paymentWeb;
export type { PaymentWebResponse };
