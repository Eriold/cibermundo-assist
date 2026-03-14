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
  private readonly recipientNameSelectors = [
    "#tbxNombreDes",
    "[id$='tbxNombreDes']",
    "[name$='tbxNombreDes']",
  ];
  private readonly recipientPhoneSelectors = [
    "#tbxTelefonoDes",
    "[id$='tbxTelefonoDes']",
    "[name$='tbxTelefonoDes']",
  ];

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
    console.log("[APX] Launching browser (headless:", headless, ") - User:", this.user);

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

    console.log("[APX] Browser initialized with stealth settings. User Agent set.");
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
    this.loginPage.setDefaultTimeout(30000);
    this.loginPage.setDefaultNavigationTimeout(60000);

    // Navegar al login — domcontentloaded es más rápido y menos propenso a colgarse que networkidle
    await this.loginPage.goto(this.loginUrl, { waitUntil: "domcontentloaded" });
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
      // Ya se hizo submit via JS o está en proceso
    }

    // Esperar a que cargue la página post-login (puede ser muy lento)
    console.log("[APX] Waiting for authentication to complete...");
    
    try {
      // Intentar detectar si ya estamos en la página de aplicaciones
      await Promise.race([
        this.loginPage.waitForSelector('text="BIENVENIDO"', { timeout: 60000 }),
        this.loginPage.waitForURL("**/home/aplicaciones", { timeout: 60000 })
      ]);
      console.log("[APX] Login successful, dashboard reached.");
    } catch (err) {
      console.log("[APX] Warning: Success indicator not found within 60s, checking current URL...");
      if (this.loginPage.url().includes("/home/aplicaciones")) {
        console.log("[APX] URL confirms we are in the dashboard.");
      } else {
        console.warn("[APX] Login might have failed or is extremely slow. URL:", this.loginPage.url());
      }
    }

    await this.loginPage.waitForTimeout(1000);

    // Debug: capturar screenshot y HTML para diagnosticar
    try {
      await this.loginPage.screenshot({ path: "apx-login-debug.png", fullPage: true });
      console.log("[APX] Debug screenshot saved to apx-login-debug.png");
    } catch {}

    console.log("[APX] Post-login URL:", this.loginPage.url());
    this.isLoggedIn = true;
  }

  // ─── Navegar a Explorador Envíos (nueva pestaña) ─────────

  private async navigateToExplorer(): Promise<void> {
    if (!this.loginPage || !this.isLoggedIn) {
      await this.login();
    }

    console.log("[APX] Navigating to Explorador Envíos via dashboard click...");

    try {
      // Selector específico basado en el HTML proporcionado por el usuario
      const cardSelector = 'div.bs-tarjetas[title="Explorador Envios"]';
      
      console.log("[APX] Waiting for Explorador Envíos card...");
      await this.loginPage!.waitForSelector(cardSelector, { timeout: 30000 });

      console.log("[APX] Clicking card to open NEW TAB...");

      // Capturar la nueva pestaña que se abre al hacer clic
      const [newPage] = await Promise.all([
        this.context!.waitForEvent("page", { timeout: 30000 }),
        this.loginPage!.click(cardSelector),
      ]);

      this.explorerPage = newPage;
      this.explorerPage.setDefaultTimeout(30000);
      this.explorerPage.setDefaultNavigationTimeout(60000);

      console.log("[APX] New tab opened, waiting for search input...");
      
      // Esperar a que cargue el selector clave en el Explorador (la pestaña nueva)
      await this.explorerPage.waitForSelector("#tbxNumeroGuia", { timeout: 30000 });
      
      console.log("[APX] Explorer page (new tab) ready via click strategy");
      this.isOnExplorerPage = true;
    } catch (error) {
      console.error("[APX] Click-based navigation failed:", (error as any).message);
      
      // Tomar screenshot para ver por qué falló el clic
      try {
        await this.loginPage!.screenshot({ path: "apx-click-fail.png" });
      } catch {}
      
      throw error;
    }
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

  private async readFirstNonEmpty(page: Page, selectors: string[]): Promise<string | undefined> {
    for (const selector of selectors) {
      const value = await page.evaluate((sel) => {
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
      }, selector).catch(() => null);

      if (value && value.trim().length > 0) {
        return value.trim();
      }
    }

    return undefined;
  }

  private async scrapeRecipientInfo(page: Page): Promise<{
    recipientName?: string;
    recipientPhone?: string;
  }> {
    const timeoutMs = 12000;
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const [recipientName, recipientPhone] = await Promise.all([
        this.readFirstNonEmpty(page, this.recipientNameSelectors),
        this.readFirstNonEmpty(page, this.recipientPhoneSelectors),
      ]);

      if (recipientName || recipientPhone) {
        return { recipientName, recipientPhone };
      }

      await page.waitForTimeout(500);
    }

    return {
      recipientName: await this.readFirstNonEmpty(page, this.recipientNameSelectors),
      recipientPhone: await this.readFirstNonEmpty(page, this.recipientPhoneSelectors),
    };
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

      // Debug: ver si la página cargó bien
      try {
        await page.screenshot({ path: "apx-explorer-debug.png" });
        console.log("[APX] Explorer tab screenshot saved to apx-explorer-debug.png");
      } catch {}

      // Limpiar campo y escribir número de guía
      console.log(`[APX] Searching guide: ${trackingNumber}`);
      await page.waitForSelector("#tbxNumeroGuia", { timeout: 10000 });
      await page.click("#tbxNumeroGuia");
      await page.fill("#tbxNumeroGuia", "");
      await page.type("#tbxNumeroGuia", trackingNumber, { delay: 30 });

      // Presionar Enter o click en botón
      console.log("[APX] Clicking search button (#btnShow)...");
      await page.click("#btnShow");
      
      // Esperar a que cargue la respuesta
      // Nota: A veces estas páginas ASPX no disparan networkidle correctamente
      await page.waitForLoadState("load", { timeout: 20000 }).catch(() => {
        console.log("[APX] Load timeout, continuing anyway...");
      });
      await page.waitForTimeout(3000); // Esperar renderizado de tablas

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
      // Esperar un poco a que los campos se llenen tras el clic de búsqueda
      console.log("[APX] Scraping recipient info...");
      
      let recipientName: string | undefined;
      let recipientPhone: string | undefined;

      try {
        const recipientData = await this.scrapeRecipientInfo(page);
        recipientName = recipientData.recipientName;
        recipientPhone = recipientData.recipientPhone;
      } catch (err) {
        console.log("[APX] Error scraping recipient info:", (err as any).message);
      }

      // Limpiar valores
      recipientName = recipientName ? recipientName.trim() : undefined;
      recipientPhone = recipientPhone ? recipientPhone.trim() : undefined;
      
      if (recipientName) console.log(`[APX] Found recipient: ${recipientName}`);

      // ─── Scrape Flujo Guía ────────────────────────────────

      // Hacer clic en la pestaña "Flujo Guia"
      try {
        await page.click("#__tab_TabContainer2_TabPanel7", { timeout: 10000 });
        await page.waitForTimeout(1500); // Esperar carga del tab

        // Reintentar lectura del destinatario después del postback/tab switch
        if (!recipientName || !recipientPhone) {
          const recipientData = await this.scrapeRecipientInfo(page);
          recipientName = recipientName || recipientData.recipientName;
          recipientPhone = recipientPhone || recipientData.recipientPhone;
        }
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
