/**
 * APX Client - Playwright singleton para scraping del portal APX (InterRapidísimo)
 * Mantiene sesión persistente: login una sola vez, buscar guía tras guía.
 * Re-autentica solo cuando la sesión expira.
 */

import { chromium, Browser, BrowserContext, Page } from "playwright";

// ─── Interfaces ──────────────────────────────────────────────

export interface TrackingFlowRow {
  ciudad: string;
  descripcion_estado: string;
  fecha_cambio_estado: string;
  bodega: string;
  motivo: string;
  mensajero: string;
  numero_tipo_impreso: string;
  descripcion_tipo_impreso: string;
  usuario: string;
  observacion: string;
  has_location_icon: boolean;
}

export interface ApxData {
  recipient_name?: string;
  recipient_phone?: string;
  // Comentados para uso futuro:
  // recipient_id?: string;
  // recipient_address?: string;
  // recipient_email?: string;
  tracking_flow: TrackingFlowRow[];
  gestion_count: number;
}

export interface ApxResult {
  success: boolean;
  data?: ApxData;
  error?: string;
  needsHuman?: boolean;
}

// ─── Singleton Scraper ──────────────────────────────────────

class ApxClientSingleton {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private loginPage: Page | null = null;      // Página de login
  private explorerPage: Page | null = null;   // Página de Explorador Envíos (nueva pestaña)
  private isLoggedIn = false;
  private isOnExplorerPage = false;

  private get loginUrl(): string {
    return process.env.APX_URL || "https://www3.interrapidisimo.com/SitioLogin/auth/login";
  }
  private get user(): string {
    return process.env.APX_USER || "";
  }
  private get pass(): string {
    return process.env.APX_PASS || "";
  }
  private get scrapeDelayMs(): number {
    return parseInt(process.env.APX_SCRAPE_DELAY_MS || "10000", 10);
  }

  // ─── Inicializar Browser ─────────────────────────────────

  async init(): Promise<void> {
    if (this.browser) {
      console.log("[APX] Browser already initialized");
      return;
    }

    const headless = process.env.HEADLESS !== "false";
    console.log("[APX] Launching browser (headless:", headless, ")");

    this.browser = await chromium.launch({ headless });
    this.context = await this.browser.newContext();

    console.log("[APX] Browser initialized");
  }

  // ─── Login al portal APX ─────────────────────────────────

  private async login(): Promise<void> {
    if (!this.browser || !this.context) {
      await this.init();
    }

    console.log("[APX] Logging in to APX portal...");

    // Cerrar páginas anteriores si existen
    if (this.explorerPage) {
      try { await this.explorerPage.close(); } catch {}
      this.explorerPage = null;
    }
    if (this.loginPage) {
      try { await this.loginPage.close(); } catch {}
      this.loginPage = null;
    }

    this.isLoggedIn = false;
    this.isOnExplorerPage = false;

    this.loginPage = await this.context!.newPage();
    this.loginPage.setDefaultTimeout(20000);
    this.loginPage.setDefaultNavigationTimeout(40000);

    // Navegar al login — networkidle para que Angular termine de inicializar
    await this.loginPage.goto(this.loginUrl, { waitUntil: "networkidle" });
    console.log("[APX] Login page loaded:", this.loginPage.url());

    // Esperar que Angular renderice el formulario completamente
    await this.loginPage.waitForSelector("#usernameLogin", { timeout: 20000 });
    await this.loginPage.waitForTimeout(2000); // Angular bootstrap 

    // Usar setter nativo de HTMLInputElement para que Angular detecte los cambios
    await this.loginPage.evaluate((creds) => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, "value"
      )!.set!;

      const userInput = document.querySelector("#usernameLogin") as HTMLInputElement;
      const passInput = document.querySelector("#passwordLogin") as HTMLInputElement;

      // Setear valor usando el setter nativo (Angular intercepta esto)
      nativeSetter.call(userInput, creds.user);
      userInput.dispatchEvent(new Event("input", { bubbles: true }));
      userInput.dispatchEvent(new Event("change", { bubbles: true }));

      nativeSetter.call(passInput, creds.pass);
      passInput.dispatchEvent(new Event("input", { bubbles: true }));
      passInput.dispatchEvent(new Event("change", { bubbles: true }));
    }, { user: this.user, pass: this.pass });

    console.log("[APX] Credentials set via native setter, waiting for button...");

    // Esperar que Angular habilite el botón
    try {
      await this.loginPage.waitForSelector("#botonLogin:not([disabled])", { timeout: 5000 });
      console.log("[APX] Button enabled naturally");
    } catch {
      // Último recurso: submit el formulario directamente, no el botón
      console.log("[APX] Button still disabled, submitting form via JS...");
      await this.loginPage.evaluate(() => {
        const form = document.querySelector("form");
        if (form) {
          form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        }
        // También intentar click forzado
        const btn = document.querySelector("#botonLogin") as HTMLButtonElement;
        if (btn) {
          btn.disabled = false;
          btn.click();
        }
      });
    }

    // Si el botón está habilitado, hacer click normal
    try {
      await this.loginPage.click("#botonLogin", { timeout: 2000 });
    } catch {
      // Ya se hizo submit via JS arriba
    }
    
    // Esperar a que cargue la página post-login
    await this.loginPage.waitForLoadState("networkidle").catch(() => {
      console.log("[APX] Post-login networkidle timeout, continuing...");
    });
    await this.loginPage.waitForTimeout(2000);

    console.log("[APX] Post-login URL:", this.loginPage.url());
    this.isLoggedIn = true;
  }

  // ─── Navegar a Explorador Envíos (nueva pestaña) ─────────

  private async navigateToExplorer(): Promise<void> {
    if (!this.loginPage || !this.isLoggedIn) {
      await this.login();
    }

    console.log("[APX] Navigating to Explorador Envíos...");

    // Buscar y hacer clic en el enlace de Explorador Envíos
    // Esto abre una NUEVA PESTAÑA, así que capturamos el evento 'page'
    const [newPage] = await Promise.all([
      this.context!.waitForEvent("page", { timeout: 15000 }),
      this.loginPage!.click('a[href*="ExploradorEnvios"]'),
    ]);

    this.explorerPage = newPage;
    this.explorerPage.setDefaultTimeout(20000);
    this.explorerPage.setDefaultNavigationTimeout(40000);

    await this.explorerPage.waitForLoadState("domcontentloaded");
    await this.explorerPage.waitForSelector("#tbxNumeroGuia", { timeout: 15000 });

    console.log("[APX] Explorer page ready:", this.explorerPage.url());
    this.isOnExplorerPage = true;
  }

  // ─── Verificar si la sesión sigue activa ──────────────────

  private async isSessionValid(): Promise<boolean> {
    if (!this.explorerPage || !this.isOnExplorerPage) return false;

    try {
      // Verificar que el campo de búsqueda existe
      const input = await this.explorerPage.$("#tbxNumeroGuia");
      if (!input) return false;

      // Verificar que no estamos en página de login
      const url = this.explorerPage.url();
      if (url.includes("login") || url.includes("Login")) return false;

      return true;
    } catch {
      return false;
    }
  }

  // ─── Asegurar que tenemos sesión válida ───────────────────

  private async ensureSession(): Promise<void> {
    const valid = await this.isSessionValid();
    if (valid) {
      console.log("[APX] Session is valid, reusing...");
      return;
    }

    console.log("[APX] Session expired or not established, re-authenticating...");
    await this.login();
    await this.navigateToExplorer();
  }

  // ─── Buscar una guía específica ───────────────────────────

  async fetchGuideData(trackingNumber: string): Promise<ApxResult> {
    try {
      // Validar input
      if (!trackingNumber || trackingNumber.trim().length === 0) {
        return { success: false, error: "Invalid tracking number", needsHuman: true };
      }

      // Asegurar sesión
      await this.ensureSession();
      const page = this.explorerPage!;

      // Limpiar campo y escribir número de guía
      console.log(`[APX] Searching guide: ${trackingNumber}`);
      await page.click("#tbxNumeroGuia");
      await page.fill("#tbxNumeroGuia", "");
      await page.fill("#tbxNumeroGuia", trackingNumber);

      // Presionar Enter o click en botón
      await page.click("#btnShow");
      
      // Esperar a que cargue la respuesta
      await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {
        console.log("[APX] networkidle timeout, continuing...");
      });
      await page.waitForTimeout(2000); // Esperar renderizado completo

      // Verificar si la sesión expiró durante la búsqueda
      const currentUrl = page.url();
      if (currentUrl.includes("login") || currentUrl.includes("Login")) {
        console.log("[APX] Session expired during search, re-authenticating...");
        this.isLoggedIn = false;
        this.isOnExplorerPage = false;
        await this.ensureSession();
        // Reintentar la búsqueda
        return this.fetchGuideData(trackingNumber);
      }

      // ─── Scrape Destinatario ──────────────────────────────

      let recipientName: string | undefined;
      let recipientPhone: string | undefined;

      try {
        recipientName = await page.inputValue("#tbxNombreDes").catch(() => undefined);
        recipientPhone = await page.inputValue("#tbxTelefonoDes").catch(() => undefined);
      } catch {
        console.log("[APX] Could not scrape recipient info (may be empty)");
      }

      // Limpiar valores vacíos
      if (recipientName !== undefined) recipientName = recipientName.trim() || undefined;
      if (recipientPhone !== undefined) recipientPhone = recipientPhone.trim() || undefined;

      // ─── Scrape Flujo Guía ────────────────────────────────

      // Hacer clic en la pestaña "Flujo Guia"
      try {
        await page.click("#__tab_TabContainer2_TabPanel7", { timeout: 10000 });
        await page.waitForTimeout(1500); // Esperar carga del tab
      } catch (err) {
        console.log("[APX] Could not click Flujo Guía tab:", err);
        return {
          success: true,
          data: {
            recipient_name: recipientName,
            recipient_phone: recipientPhone,
            tracking_flow: [],
            gestion_count: 0,
          },
        };
      }

      // Extraer filas de la tabla Flujo Guía
      const trackingFlow = await this.scrapeFlowTable(page);
      
      // Calcular gestion_count
      const gestionCount = this.calculateGestionCount(trackingFlow);

      console.log(`[APX] Guide ${trackingNumber}: ${trackingFlow.length} flow rows, ${gestionCount} gestiones`);

      return {
        success: true,
        data: {
          recipient_name: recipientName,
          recipient_phone: recipientPhone,
          tracking_flow: trackingFlow,
          gestion_count: gestionCount,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[APX] Error fetching guide ${trackingNumber}:`, errorMsg);

      // Si es error de navegación/timeout, marcar sesión como inválida
      if (
        errorMsg.includes("Timeout") ||
        errorMsg.includes("closed") ||
        errorMsg.includes("Target closed") ||
        errorMsg.includes("Navigation")
      ) {
        this.isLoggedIn = false;
        this.isOnExplorerPage = false;
        return { success: false, error: `Network/session error: ${errorMsg}`, needsHuman: false };
      }

      return { success: false, error: `APX error: ${errorMsg}`, needsHuman: true };
    }
  }

  // ─── Extraer tabla Flujo Guía ─────────────────────────────

  private async scrapeFlowTable(page: Page): Promise<TrackingFlowRow[]> {
    const rows: TrackingFlowRow[] = [];

    try {
      // Esperar que la tabla exista
      await page.waitForSelector("#TabContainer2_TabPanel7_gvFlujoGuia", { timeout: 10000 });

      // Extraer datos de cada fila (saltar la primera fila que es el header)
      const rowElements = await page.$$("#TabContainer2_TabPanel7_gvFlujoGuia tr:not(:first-child)");

      for (const row of rowElements) {
        const cells = await row.$$("td");
        if (cells.length < 11) continue; // Necesitamos al menos 11 columnas

        // Columna 0: imagen de ubicación (si tiene <input type="image">)
        const hasLocationIcon = await cells[0].$('input[type="image"]') !== null;

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
    } catch (err) {
      console.error("[APX] Error scraping flow table:", err);
    }

    return rows;
  }

  // ─── Calcular Gestiones ───────────────────────────────────

  private calculateGestionCount(rows: TrackingFlowRow[]): number {
    let count = 0;

    for (const row of rows) {
      const ciudadMatch = row.ciudad.toUpperCase().includes("URRAO");
      const estadoMatch = row.descripcion_estado.toUpperCase().includes("DEVOLUCIÓN") 
                       || row.descripcion_estado.toUpperCase().includes("DEVOLUCION");
      const fechaValid = row.fecha_cambio_estado.trim().length > 0;

      if (ciudadMatch && estadoMatch && fechaValid) {
        count++;
      }
    }

    return count;
  }

  // ─── Espera configurable entre scrapes ────────────────────

  async waitBetweenScrapes(): Promise<void> {
    const delay = this.scrapeDelayMs;
    console.log(`[APX] Waiting ${delay}ms before next scrape...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // ─── Cerrar browser ───────────────────────────────────────

  async close(): Promise<void> {
    if (this.browser) {
      console.log("[APX] Closing browser");
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.loginPage = null;
      this.explorerPage = null;
      this.isLoggedIn = false;
      this.isOnExplorerPage = false;
    }
  }

  isInitialized(): boolean {
    return this.browser !== null;
  }
}

// Singleton instance
const apxClient = new ApxClientSingleton();
export default apxClient;
