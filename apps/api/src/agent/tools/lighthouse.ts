import * as chromeLauncher from "chrome-launcher";
import lighthouse, { desktopConfig } from "lighthouse";
import PQueue from "p-queue";
import { env } from "../../env";

export type FormFactor = "mobile" | "desktop";
type LhResult = NonNullable<Awaited<ReturnType<typeof lighthouse>>>["lhr"];

export const METRIC_IDS = {
  fcp: "first-contentful-paint",
  lcp: "largest-contentful-paint",
  tbt: "total-blocking-time",
  cls: "cumulative-layout-shift",
  si: "speed-index",
} as const;
export type MetricKey = keyof typeof METRIC_IDS;

export interface LighthouseItem {
  label: string;
  bytes?: number;
  ms?: number;
}

export interface LighthouseAudit {
  id: string;
  title: string;
  description: string;
  score: number | null;
  displayValue?: string;
  items: LighthouseItem[];
}

/** The slice of a Lighthouse report we keep; full reports are several MB. */
export interface LighthouseSummary {
  formFactor: FormFactor;
  finalUrl: string;
  scores: Record<"performance" | "accessibility" | "seo", number | null>;
  metrics: Record<MetricKey, { value: number; display: string; score: number | null }>;
  audits: Record<string, LighthouseAudit>;
  largestRequests: LighthouseItem[];
}

// ---------- report trimming ----------

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

const toItem = (raw: Record<string, unknown>): LighthouseItem | null => {
  const source = raw.url ?? raw.entity ?? raw.source ?? raw.node;
  const label =
    typeof source === "string"
      ? source
      : isRecord(source)
        ? String(source.url ?? source.text ?? source.snippet ?? source.nodeLabel ?? "")
        : "";
  if (!label) return null;
  return {
    label: label.slice(0, 200),
    bytes: num(raw.transferSize) ?? num(raw.wastedBytes) ?? num(raw.totalBytes),
    ms: num(raw.wastedMs) ?? num(raw.blockingTime) ?? num(raw.mainThreadTime) ?? num(raw.total),
  };
};

/** Table/opportunity details have `items`; insight "list" details nest tables inside items. */
const collectItems = (details: unknown): Record<string, unknown>[] => {
  if (!isRecord(details) || !Array.isArray(details.items)) return [];
  return details.items.filter(isRecord).flatMap((item) => (Array.isArray(item.items) ? collectItems(item) : [item]));
};

const summarizeAudit = (lhr: LhResult, id: string): LighthouseAudit | null => {
  const audit = lhr.audits[id];
  if (!audit || audit.scoreDisplayMode === "notApplicable" || audit.scoreDisplayMode === "manual") return null;
  const items = collectItems(audit.details)
    .map(toItem)
    .filter((i): i is LighthouseItem => i !== null)
    .slice(0, 5);
  return {
    id,
    title: audit.title,
    description: audit.description.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"),
    score: audit.score,
    displayValue: audit.displayValue,
    items,
  };
};

const categoryScore = (lhr: LhResult, id: "performance" | "accessibility" | "seo") => {
  const score = lhr.categories[id]?.score;
  return typeof score === "number" ? Math.round(score * 100) : null;
};

const summarize = (lhr: LhResult, formFactor: FormFactor): LighthouseSummary => {
  const auditIds = (["performance", "accessibility", "seo"] as const).flatMap(
    (c) => lhr.categories[c]?.auditRefs.map((ref) => ref.id) ?? [],
  );
  const audits = Object.fromEntries(
    auditIds.map((id) => summarizeAudit(lhr, id)).flatMap((a) => (a ? [[a.id, a] as const] : [])),
  );
  const metrics = Object.fromEntries(
    Object.entries(METRIC_IDS).map(([key, id]) => {
      const audit = lhr.audits[id];
      return [key, { value: audit?.numericValue ?? 0, display: audit?.displayValue ?? "–", score: audit?.score ?? null }];
    }),
  ) as LighthouseSummary["metrics"];

  const largestRequests = collectItems(lhr.audits["network-requests"]?.details)
    .toSorted((a, b) => (num(b.transferSize) ?? 0) - (num(a.transferSize) ?? 0))
    .map(toItem)
    .filter((i): i is LighthouseItem => i !== null)
    .slice(0, 5);

  return {
    formFactor,
    finalUrl: lhr.finalDisplayedUrl,
    scores: {
      performance: categoryScore(lhr, "performance"),
      accessibility: categoryScore(lhr, "accessibility"),
      seo: categoryScore(lhr, "seo"),
    },
    metrics,
    audits,
    largestRequests,
  };
};

// ---------- running ----------

const runLighthouse = async (url: string, formFactor: FormFactor): Promise<LighthouseSummary> => {
  const chrome = await chromeLauncher.launch({
    chromePath: env.CHROME_PATH,
    chromeFlags: ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check"],
  });
  try {
    const result = await lighthouse(
      url,
      { port: chrome.port, output: "json", logLevel: "error", onlyCategories: ["performance", "accessibility", "seo"] },
      formFactor === "desktop" ? desktopConfig : undefined,
    );
    if (!result) throw new Error("Lighthouse returned no result");
    if (result.lhr.runtimeError) throw new Error(result.lhr.runtimeError.message);
    return summarize(result.lhr, formFactor);
  } finally {
    // chrome-launcher can fail to delete its temp profile on Windows; that's harmless.
    await Promise.resolve(chrome.kill()).catch(() => undefined);
  }
};

// Lighthouse measures timing, so runs must not overlap (they'd skew each other).
const queue = new PQueue({ concurrency: 1 });
const cache = new Map<string, { expires: number; result: Promise<LighthouseSummary> }>();

/**
 * Cached, serialized Lighthouse run. Concurrent callers for the same URL and form factor share
 * one run, so the lighthouse, accessibility and SEO nodes never duplicate work.
 */
export const getLighthouse = (url: string, formFactor: FormFactor): Promise<LighthouseSummary> => {
  const key = `${formFactor}|${url}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.result;

  const result = queue.add(() => runLighthouse(url, formFactor));
  cache.set(key, { expires: Date.now() + env.LIGHTHOUSE_CACHE_TTL_MS, result });
  result.catch(() => cache.delete(key));
  return result;
};
