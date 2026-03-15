/**
 * APX Client - Playwright singleton para scraping del portal APX (InterRapidisimo)
 * Mantiene sesion persistente: login una sola vez, buscar guia tras guia.
 * Re-autentica solo cuando la sesion expira.
 */

import { chromium, Browser, BrowserContext, Page } from "playwright";
import {
  closePage,
  finalizeLogin,
  isExplorerSessionValid,
  openExplorerPage,
  submitLoginCredentials,
} from "./apx-session.js";
import {
  EXPLORER_CARD_SELECTOR,
  EXPLORER_SEARCH_BUTTON_SELECTOR,
  EXPLORER_SEARCH_INPUT_SELECTOR,
  FLOW_TAB_SELECTOR,
} from "./apx-constants.js";
import { calculateGestionCount, scrapeFlowTable, scrapeRecipientInfo } from "./apx-scraping.js";
import type { ApxResult } from "./apx-types.js";

class ApxClientSingleton {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private loginPage: Page | null = null;
  private explorerPage: Page | null = null;
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
        "--disable-setuid-sandbox",
      ],
      ignoreDefaultArgs: ["--enable-automation"],
    });

    this.context = await this.browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
      javaScriptEnabled: true,
    });

    console.log("[APX] Browser initialized with stealth settings. User Agent set.");
  }

  private async resetPages(): Promise<void> {
    await closePage(this.explorerPage);
    await closePage(this.loginPage);
    this.explorerPage = null;
    this.loginPage = null;

    this.isLoggedIn = false;
    this.isOnExplorerPage = false;
  }

  private async login(): Promise<void> {
    if (!this.browser || !this.context) {
      await this.init();
    }

    console.log("[APX] Logging in to APX portal...");
    await this.resetPages();

    this.loginPage = await this.context!.newPage();
    this.loginPage.setDefaultTimeout(30000);
    this.loginPage.setDefaultNavigationTimeout(60000);

    await this.loginPage.goto(this.loginUrl, { waitUntil: "domcontentloaded" });
    console.log("[APX] Login page loaded:", this.loginPage.url());

    await this.loginPage.waitForSelector("#usernameLogin", { timeout: 20000 });
    await this.loginPage.waitForTimeout(2000);
    await submitLoginCredentials(this.loginPage, this.user, this.pass);
    await finalizeLogin(this.loginPage);
    this.isLoggedIn = true;
  }

  private async navigateToExplorer(): Promise<void> {
    if (!this.loginPage || !this.isLoggedIn) {
      await this.login();
    }

    this.explorerPage = await openExplorerPage(this.loginPage!, this.context!);
    this.isOnExplorerPage = true;
  }

  private async isSessionValid(): Promise<boolean> {
    return isExplorerSessionValid(this.explorerPage, this.isOnExplorerPage);
  }

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

  private invalidateSession(): void {
    this.isLoggedIn = false;
    this.isOnExplorerPage = false;
  }

  private async executeGuideSearch(page: Page, trackingNumber: string): Promise<void> {
    console.log(`[APX] Searching guide: ${trackingNumber}`);
    await page.waitForSelector(EXPLORER_SEARCH_INPUT_SELECTOR, { timeout: 10000 });
    await page.click(EXPLORER_SEARCH_INPUT_SELECTOR);
    await page.fill(EXPLORER_SEARCH_INPUT_SELECTOR, "");
    await page.type(EXPLORER_SEARCH_INPUT_SELECTOR, trackingNumber, { delay: 30 });

    console.log(`[APX] Clicking search button (${EXPLORER_SEARCH_BUTTON_SELECTOR})...`);
    await page.click(EXPLORER_SEARCH_BUTTON_SELECTOR);
    await page.waitForLoadState("load", { timeout: 20000 }).catch(() => {
      console.log("[APX] Load timeout, continuing anyway...");
    });
    await page.waitForTimeout(3000);
  }

  async fetchGuideData(trackingNumber: string): Promise<ApxResult> {
    try {
      if (!trackingNumber || trackingNumber.trim().length === 0) {
        return { success: false, error: "Invalid tracking number", needsHuman: true };
      }

      await this.ensureSession();
      const page = this.explorerPage!;

      try {
        await page.screenshot({ path: "apx-explorer-debug.png" });
        console.log("[APX] Explorer tab screenshot saved to apx-explorer-debug.png");
      } catch {}

      await this.executeGuideSearch(page, trackingNumber);

      const currentUrl = page.url();
      if (currentUrl.includes("login") || currentUrl.includes("Login")) {
        console.log("[APX] Session expired during search, re-authenticating...");
        this.invalidateSession();
        await this.ensureSession();
        return this.fetchGuideData(trackingNumber);
      }

      console.log("[APX] Scraping recipient info...");
      let recipientName: string | undefined;
      let recipientPhone: string | undefined;

      try {
        const recipientData = await scrapeRecipientInfo(page);
        recipientName = recipientData.recipientName?.trim();
        recipientPhone = recipientData.recipientPhone?.trim();
      } catch (error) {
        console.log("[APX] Error scraping recipient info:", (error as any).message);
      }

      if (recipientName) {
        console.log(`[APX] Found recipient: ${recipientName}`);
      }

      try {
        await page.click(FLOW_TAB_SELECTOR, { timeout: 10000 });
        await page.waitForTimeout(1500);

        if (!recipientName || !recipientPhone) {
          const recipientData = await scrapeRecipientInfo(page);
          recipientName = recipientName || recipientData.recipientName?.trim();
          recipientPhone = recipientPhone || recipientData.recipientPhone?.trim();
        }
      } catch (error) {
        console.log("[APX] Could not click Flujo Guia tab:", error);
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

      const trackingFlow = await scrapeFlowTable(page);
      const gestionCount = calculateGestionCount(trackingFlow);

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

      if (
        errorMsg.includes("Timeout") ||
        errorMsg.includes("closed") ||
        errorMsg.includes("Target closed") ||
        errorMsg.includes("Navigation")
      ) {
        this.invalidateSession();
        return { success: false, error: `Network/session error: ${errorMsg}`, needsHuman: false };
      }

      return { success: false, error: `APX error: ${errorMsg}`, needsHuman: true };
    }
  }

  async waitBetweenScrapes(): Promise<void> {
    const delay = this.scrapeDelayMs;
    console.log(`[APX] Waiting ${delay}ms before next scrape...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  async close(): Promise<void> {
    if (!this.browser) return;

    console.log("[APX] Closing browser");
    await this.browser.close();
    this.browser = null;
    this.context = null;
    this.loginPage = null;
    this.explorerPage = null;
    this.isLoggedIn = false;
    this.isOnExplorerPage = false;
  }

  isInitialized(): boolean {
    return this.browser !== null;
  }
}

const apxClient = new ApxClientSingleton();
export default apxClient;
