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
          await page.goto("https://www3.interrapidisimo.com/SiguetuEnvio/shipment", { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(1000); // Dar un poco de tiempo para scripts
        }

        // Esperar selector visible
        console.log(`[PAYMENT_PW] Waiting for #inputGuide visible (attempt ${attemptNum})...`);
        await page.waitForSelector("#inputGuide", { timeout: 15000 });

        // Limpiar y escribir tracking number
        console.log(`[PAYMENT_PW] Filling #inputGuide with ${trackingNumber}`);
        await page.click("#inputGuide");
        await page.keyboard.down("Control");
        await page.keyboard.press("A");
        await page.keyboard.up("Control");
        await page.keyboard.press("Backspace");
        await page.type("#inputGuide", trackingNumber, { delay: 30 });

        // Crear el waitForResponse BEFORE triggering search
        console.log("[PAYMENT_PW] Waiting for API response...");
        const waitForResponsePromise = page.waitForResponse(
          (response: any) =>
            response.url().includes("ObtenerRastreoGuiasClientePost") &&
            response.request().method() === "POST" &&
            response.status() === 200,
          { timeout: 30000 }
        );

        // Disparar búsqueda con ENTER
        await page.keyboard.press("Enter");

        // Fallback: si ENTER no funciona, intentar clic en el botón de búsqueda
        let responseReceived = false;
        const clickTimer = setTimeout(async () => {
          if (!responseReceived) {
            console.log("[PAYMENT_PW] No response after 1s, clicking search button...");
            try {
              await page.click(".search-button a.right-button", { timeout: 5000 });
            } catch (e) {}
          }
        }, 1000);

        try {
          const response = await waitForResponsePromise;
          responseReceived = true;
          clearTimeout(clickTimer);

          const responseJson: PaymentWebResponse = await response.json();
          console.log(`[PAYMENT_PW] Got response Success=${responseJson.Success}`);

          return responseJson;
        } catch (error) {
          clearTimeout(clickTimer);
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
