import { type Browser, type BrowserContextOptions, chromium, type Page } from "playwright";
import { isPublicHost } from "../../security/ssrf";
import { PAGE_LOAD_TIMEOUT_MS } from "../config";

// tsx/esbuild wrap functions in __name() to keep their names; functions passed to
// page.evaluate() run in the browser, where that helper doesn't exist.
const NAME_HELPER_SHIM = "globalThis.__name = (fn) => fn;";

/**
 * One headless browser per audit, launched on first use. Every context it creates blocks
 * requests (including redirects and subresources) to hosts that resolve to private addresses.
 */
export const createBrowserHandle = () => {
  let browser: Promise<Browser> | null = null;
  const hostVerdicts = new Map<string, Promise<boolean>>();

  const isAllowed = (url: string) => {
    const { protocol, hostname } = new URL(url);
    if (protocol === "data:" || protocol === "blob:") return Promise.resolve(true);
    if (protocol !== "http:" && protocol !== "https:") return Promise.resolve(false);
    const verdict = hostVerdicts.get(hostname) ?? isPublicHost(hostname);
    hostVerdicts.set(hostname, verdict);
    return verdict;
  };

  const get = () => {
    browser ??= chromium.launch({ headless: true });
    return browser;
  };

  /** Opens `url` in a fresh guarded context, runs `fn`, and always cleans up. */
  const withPage = async <T>(url: string, options: BrowserContextOptions, fn: (page: Page) => Promise<T>): Promise<T> => {
    const context = await (await get()).newContext(options);
    try {
      await context.addInitScript(NAME_HELPER_SHIM);
      await context.route("**/*", async (route) =>
        (await isAllowed(route.request().url())) ? route.continue() : route.abort("blockedbyclient"),
      );
      const page = await context.newPage();
      await page.goto(url, { waitUntil: "load", timeout: PAGE_LOAD_TIMEOUT_MS });
      // Give client-rendered content a moment; don't fail if the network never goes idle.
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
      return await fn(page);
    } finally {
      await context.close().catch(() => undefined);
    }
  };

  return {
    withPage,
    close: async () => {
      if (browser) await (await browser).close().catch(() => undefined);
    },
  };
};

export type BrowserHandle = ReturnType<typeof createBrowserHandle>;
