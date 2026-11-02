import { CRAWL_MAX_PAGES } from "../config";
import type { NodeOutcome } from "../safe-node";
import { fetchSafe } from "../tools/fetch-safe";
import type { AgentContext, CrawledPage, SiteFiles } from "../types";
import { plural } from "./shared";

/** Runs inside the page. Must be self-contained: it's serialised and sent to the browser. */
const extractPage = () => {
  const attr = (selector: string, name: string) => document.querySelector(selector)?.getAttribute(name) ?? null;
  const clean = (s: string | null) => (s ?? "").replace(/\s+/g, " ").trim();
  return {
    title: clean(document.title),
    metaDescription: attr('meta[name="description"]', "content"),
    lang: document.documentElement.getAttribute("lang") || null,
    canonical: attr('link[rel="canonical"]', "href"),
    viewportMeta: attr('meta[name="viewport"]', "content"),
    headings: [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")]
      .map((h) => ({ level: Number(h.tagName[1]), text: clean(h.textContent).slice(0, 200) }))
      .filter((h) => h.text),
    links: [...document.querySelectorAll("a[href]")].map((a) => (a as HTMLAnchorElement).href),
    images: [...document.images].map((img) => ({ src: img.currentSrc || img.src, alt: img.getAttribute("alt") })),
    og: Object.fromEntries(
      [...document.querySelectorAll('meta[property^="og:"]')].map((m) => [m.getAttribute("property") ?? "", m.getAttribute("content") ?? ""]),
    ),
    jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap((s) => {
      try {
        return [JSON.parse(s.textContent ?? "") as unknown];
      } catch {
        return [];
      }
    }),
    text: (document.body?.innerText ?? "").slice(0, 60_000),
  };
};

const PRIORITY_PATHS = /about|pricing|price|product|service|feature|contact|faq|blog|menu|shop|plans|team|how/i;
const ASSET_EXT = /\.(pdf|jpe?g|png|gif|webp|svg|zip|mp4|mp3|docx?|xlsx?)$/i;

/** Picks the most informative same-site pages linked from the homepage. */
export const pickInternalLinks = (home: string, links: string[], limit: number): string[] => {
  const base = new URL(home);
  const sameSite = (host: string) => host.replace(/^www\./, "") === base.hostname.replace(/^www\./, "");
  const candidates = links.flatMap((href) => {
    try {
      const u = new URL(href);
      if (!["http:", "https:"].includes(u.protocol) || !sameSite(u.hostname) || ASSET_EXT.test(u.pathname)) return [];
      u.hash = "";
      u.search = "";
      return u.pathname === base.pathname || u.pathname === "/" ? [] : [u.toString()];
    } catch {
      return [];
    }
  });
  return [...new Set(candidates)]
    .toSorted((a, b) => Number(PRIORITY_PATHS.test(new URL(b).pathname)) - Number(PRIORITY_PATHS.test(new URL(a).pathname)))
    .slice(0, limit);
};

const textFile = async (url: string): Promise<string | null> => {
  try {
    const res = await fetchSafe(url, { maxBytes: 200_000, timeoutMs: 10_000 });
    const looksHtml = res.contentType.includes("html") || /^\s*<(!doctype|html)/i.test(res.body);
    return res.status === 200 && !looksHtml ? res.body : null;
  } catch {
    return null;
  }
};

const fetchSiteFiles = async (url: string): Promise<SiteFiles> => {
  const origin = new URL(url).origin;
  const [robotsTxt, llmsTxt] = await Promise.all([textFile(`${origin}/robots.txt`), textFile(`${origin}/llms.txt`)]);
  const declared = robotsTxt?.match(/^sitemap:\s*(\S+)/im)?.[1];
  const sitemap = await textFile(declared ?? `${origin}/sitemap.xml`);
  return { robotsTxt, llmsTxt, sitemapFound: Boolean(sitemap && /<(urlset|sitemapindex)/i.test(sitemap)) };
};

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

export const crawl = (ctx: AgentContext) => async (): Promise<NodeOutcome> => {
  await ctx.emit({ type: "tool_called", node: "crawl", message: "Fetching robots.txt, sitemap.xml and llms.txt", data: { tool: "crawler" } });
  const siteFilesPromise = fetchSiteFiles(ctx.url);

  await ctx.emit({ type: "tool_called", node: "crawl", message: "Rendering the homepage in a headless browser", data: { tool: "playwright" } });
  const visit = (url: string) =>
    ctx.browser.withPage(url, { viewport: { width: 1366, height: 900 } }, async (page): Promise<CrawledPage> => {
      const data = await page.evaluate(extractPage);
      return { ...data, url: page.url(), wordCount: wordCount(data.text) };
    });

  const home = await visit(ctx.url);
  const targets = pickInternalLinks(home.url, home.links, CRAWL_MAX_PAGES - 1);
  if (targets.length) {
    await ctx.emit({ type: "finding", node: "crawl", message: `Discovered ${plural(targets.length, "key internal page")}`, data: { severity: "info" } });
  }

  // Sequential on purpose: gentle on the target site and on local resources.
  const others = await targets.reduce<Promise<CrawledPage[]>>(async (acc, url) => {
    const done = await acc;
    await ctx.emit({ type: "tool_called", node: "crawl", message: `Crawling ${new URL(url).pathname}`, data: { tool: "playwright" } });
    return visit(url).then((page) => [...done, page]).catch(() => done);
  }, Promise.resolve([]));

  const siteFiles = await siteFilesPromise;
  await ctx.emit({
    type: "finding",
    node: "crawl",
    message: [
      siteFiles.robotsTxt ? "robots.txt found" : "No robots.txt",
      siteFiles.sitemapFound ? "sitemap found" : "no sitemap",
      siteFiles.llmsTxt ? "llms.txt found" : "no llms.txt",
    ].join(", "),
    data: { severity: siteFiles.robotsTxt && siteFiles.sitemapFound ? "info" : "low" },
  });

  const pages = [home, ...others];
  const words = pages.reduce((n, p) => n + p.wordCount, 0);
  return {
    update: { crawledPages: pages, siteFiles },
    summary: `Crawled ${plural(pages.length, "page")} (${words.toLocaleString("en")} words)`,
  };
};
