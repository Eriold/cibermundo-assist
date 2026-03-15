import type { BrowserContext, Page } from "playwright";
import {
  EXPLORER_CARD_SELECTOR,
  EXPLORER_SEARCH_INPUT_SELECTOR,
} from "./apx-constants.js";

export async function closePage(page: Page | null): Promise<void> {
  if (!page) return;

  try {
    await page.close();
  } catch {}
}

export async function submitLoginCredentials(page: Page, user: string, pass: string): Promise<void> {
  await page.evaluate(
    (creds) => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )!.set!;

      const userInput = document.querySelector("#usernameLogin") as HTMLInputElement;
      const passInput = document.querySelector("#passwordLogin") as HTMLInputElement;

      nativeSetter.call(userInput, creds.user);
      userInput.dispatchEvent(new Event("input", { bubbles: true }));
      userInput.dispatchEvent(new Event("change", { bubbles: true }));

      nativeSetter.call(passInput, creds.pass);
      passInput.dispatchEvent(new Event("input", { bubbles: true }));
      passInput.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { user, pass }
  );

  console.log("[APX] Credentials set via native setter, waiting for button...");

  try {
    await page.waitForSelector("#botonLogin:not([disabled])", { timeout: 5000 });
    console.log("[APX] Button enabled naturally");
  } catch {
    console.log("[APX] Button still disabled, submitting form via JS...");
    await page.evaluate(() => {
      const form = document.querySelector("form");
      if (form) {
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      }

      const btn = document.querySelector("#botonLogin") as HTMLButtonElement;
      if (btn) {
        btn.disabled = false;
        btn.click();
      }
    });
  }

  try {
    await page.click("#botonLogin", { timeout: 2000 });
  } catch {}
}

export async function finalizeLogin(page: Page): Promise<void> {
  console.log("[APX] Waiting for authentication to complete...");

  try {
    await Promise.race([
      page.waitForSelector('text="BIENVENIDO"', { timeout: 60000 }),
      page.waitForURL("**/home/aplicaciones", { timeout: 60000 }),
    ]);
    console.log("[APX] Login successful, dashboard reached.");
  } catch {
    console.log("[APX] Warning: Success indicator not found within 60s, checking current URL...");
    if (page.url().includes("/home/aplicaciones")) {
      console.log("[APX] URL confirms we are in the dashboard.");
    } else {
      console.warn("[APX] Login might have failed or is extremely slow. URL:", page.url());
    }
  }

  await page.waitForTimeout(1000);

  try {
    await page.screenshot({ path: "apx-login-debug.png", fullPage: true });
    console.log("[APX] Debug screenshot saved to apx-login-debug.png");
  } catch {}

  console.log("[APX] Post-login URL:", page.url());
}

export async function openExplorerPage(
  loginPage: Page,
  context: BrowserContext,
): Promise<Page> {
  console.log("[APX] Navigating to Explorador Envios via dashboard click...");

  try {
    await loginPage.waitForSelector(EXPLORER_CARD_SELECTOR, { timeout: 30000 });
    console.log("[APX] Clicking card to open NEW TAB...");

    const [newPage] = await Promise.all([
      context.waitForEvent("page", { timeout: 30000 }),
      loginPage.click(EXPLORER_CARD_SELECTOR),
    ]);

    newPage.setDefaultTimeout(30000);
    newPage.setDefaultNavigationTimeout(60000);

    console.log("[APX] New tab opened, waiting for search input...");
    await newPage.waitForSelector(EXPLORER_SEARCH_INPUT_SELECTOR, { timeout: 30000 });

    console.log("[APX] Explorer page (new tab) ready via click strategy");
    return newPage;
  } catch (error) {
    console.error("[APX] Click-based navigation failed:", (error as any).message);

    try {
      await loginPage.screenshot({ path: "apx-click-fail.png" });
    } catch {}

    throw error;
  }
}

export async function isExplorerSessionValid(
  explorerPage: Page | null,
  isOnExplorerPage: boolean,
): Promise<boolean> {
  if (!explorerPage || !isOnExplorerPage) return false;

  try {
    const input = await explorerPage.$(EXPLORER_SEARCH_INPUT_SELECTOR);
    if (!input) return false;

    const url = explorerPage.url();
    if (url.includes("login") || url.includes("Login")) return false;

    return true;
  } catch {
    return false;
  }
}
