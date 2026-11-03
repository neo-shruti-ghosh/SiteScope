import type { CrawledPage, SiteFiles } from "../types";

const QUESTION_START = /^(who|what|when|where|why|how|which|can|does|do|is|are|should|will)\b/i;
const MAX_PAGE_CHARS = 3_500;
const MAX_HEADINGS = 30;

/** Collects every "@type" in JSON-LD, including nested @graph entries. */
export const schemaTypes = (jsonLd: unknown[]): string[] => {
  const walk = (node: unknown): string[] => {
    if (Array.isArray(node)) return node.flatMap(walk);
    if (typeof node !== "object" || node === null) return [];
    const record = node as Record<string, unknown>;
    const own = record["@type"];
    const types = typeof own === "string" ? [own] : Array.isArray(own) ? own.filter((t): t is string => typeof t === "string") : [];
    return [...types, ...Object.values(record).flatMap(walk)];
  };
  return [...new Set(walk(jsonLd))];
};

export const isQuestionHeading = (text: string) => text.trim().endsWith("?") || QUESTION_START.test(text.trim());

/** Deterministic AEO/GEO signals, measured rather than guessed, to ground the model's judgement. */
export const contentSignals = (pages: CrawledPage[], files: SiteFiles) => {
  const headings = pages.flatMap((p) => p.headings);
  const types = schemaTypes(pages.flatMap((p) => p.jsonLd));
  const host = pages[0] ? new URL(pages[0].url).hostname.replace(/^www\./, "") : "";
  const externalLinks = pages.flatMap((p) =>
    p.links.filter((l) => {
      try {
        const h = new URL(l).hostname.replace(/^www\./, "");
        return h !== host && !/(facebook|twitter|x\.com|instagram|linkedin|youtube|tiktok|pinterest)/.test(h);
      } catch {
        return false;
      }
    }),
  );
  const allText = pages.map((p) => p.text).join("\n");
  return {
    pagesCrawled: pages.length,
    totalWords: pages.reduce((n, p) => n + p.wordCount, 0),
    questionHeadings: headings.filter((h) => isQuestionHeading(h.text)).map((h) => h.text).slice(0, 10),
    schemaTypes: types,
    hasFaqSchema: types.includes("FAQPage"),
    hasHowToSchema: types.includes("HowTo"),
    hasOrganizationSchema: types.some((t) => ["Organization", "LocalBusiness", "Corporation"].includes(t) || t.endsWith("Business")),
    llmsTxtPresent: files.llmsTxt !== null,
    externalReferenceLinks: new Set(externalLinks).size,
    mentionsAuthorOrDate: /\b(by [A-Z][a-z]+|author|published|updated|last modified)\b/i.test(allText),
    langDeclared: pages[0]?.lang ?? null,
  };
};

const pageBlock = (p: CrawledPage) =>
  [
    `<page url="${p.url}">`,
    `Title: ${p.title || "(none)"}`,
    `Meta description: ${p.metaDescription ?? "(none)"}`,
    `Headings:\n${p.headings.slice(0, MAX_HEADINGS).map((h) => `${"  ".repeat(h.level - 1)}H${h.level} ${h.text}`).join("\n") || "(none)"}`,
    `Visible text (truncated):\n${p.text.replace(/\n{3,}/g, "\n\n").slice(0, MAX_PAGE_CHARS)}`,
    "</page>",
  ].join("\n");

/** The site as the model sees it: crawl data wrapped as untrusted content, plus measured signals. */
export const siteDigest = (pages: CrawledPage[], files: SiteFiles) =>
  [
    "<site_content>",
    ...pages.map(pageBlock),
    files.llmsTxt ? `<llms_txt>\n${files.llmsTxt.slice(0, 2_000)}\n</llms_txt>` : "",
    "</site_content>",
    "",
    `<measured_signals>\n${JSON.stringify(contentSignals(pages, files), null, 2)}\n</measured_signals>`,
  ].join("\n");
