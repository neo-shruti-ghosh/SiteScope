import { CATEGORIES, type CategoryResult, type Fix, type Issue } from "@sitescope/shared";
import type { FormFactor, LighthouseSummary, MetricKey } from "../tools/lighthouse";
import { bySeverity, clampScore, firstSentence, formatBytes, formatMs, severityFromScore } from "./format";

type Rating = "good" | "needs-improvement" | "poor";

/** Core Web Vitals / Lighthouse thresholds (good ≤ first, poor > second). */
export const METRIC_THRESHOLDS: Record<MetricKey, { label: string; good: number; poor: number }> = {
  lcp: { label: "Largest Contentful Paint", good: 2500, poor: 4000 },
  fcp: { label: "First Contentful Paint", good: 1800, poor: 3000 },
  tbt: { label: "Total Blocking Time", good: 200, poor: 600 },
  cls: { label: "Cumulative Layout Shift", good: 0.1, poor: 0.25 },
  si: { label: "Speed Index", good: 3400, poor: 5800 },
};

export const rateMetric = (key: MetricKey, value: number): Rating => {
  const { good, poor } = METRIC_THRESHOLDS[key];
  return value <= good ? "good" : value <= poor ? "needs-improvement" : "poor";
};

const METRIC_FIXES: Record<MetricKey, Pick<Fix, "title" | "steps" | "effort" | "effortHint">> = {
  lcp: {
    title: "Speed up the largest above-the-fold element",
    steps:
      "Identify the LCP element (usually the hero image or headline). Serve the image in AVIF/WebP at the displayed size, add fetchpriority=\"high\" and don't lazy-load it, preload critical fonts, and cut server response time with caching or a CDN.",
    effort: "M",
    effortHint: "~half a day",
  },
  fcp: {
    title: "Get first content on screen sooner",
    steps:
      "Inline critical CSS, defer non-critical CSS and JavaScript, reduce redirects, and enable compression (Brotli/gzip) and HTTP/2 or HTTP/3 on the server.",
    effort: "M",
    effortHint: "~half a day",
  },
  tbt: {
    title: "Reduce main-thread JavaScript work",
    steps:
      "Code-split large bundles, remove unused libraries, defer third-party scripts until after load or interaction, and break long tasks into smaller chunks.",
    effort: "L",
    effortHint: "1–3 days",
  },
  cls: {
    title: "Stop layout shifts",
    steps:
      "Set explicit width and height (or aspect-ratio) on images, videos and embeds, reserve space for ads and banners, and use font-display: optional or size-adjusted fallback fonts.",
    effort: "S",
    effortHint: "~1–2 hours",
  },
  si: {
    title: "Make the page fill in faster",
    steps:
      "Prioritise above-the-fold content: preload key resources, lazy-load below-the-fold images, and reduce render-blocking CSS and JavaScript.",
    effort: "M",
    effortHint: "~half a day",
  },
};

const displayValue = (key: MetricKey, value: number) => (key === "cls" ? value.toFixed(2) : formatMs(value));

const metricIssues = (summary: LighthouseSummary): Issue[] =>
  (Object.keys(METRIC_THRESHOLDS) as MetricKey[]).flatMap((key) => {
    const { value } = summary.metrics[key];
    const rating = rateMetric(key, value);
    if (rating === "good") return [];
    const { label, good } = METRIC_THRESHOLDS[key];
    return [
      {
        id: `${summary.formFactor}-${key}`,
        title: `${label} is ${displayValue(key, value)} on ${summary.formFactor}`,
        detail: `Aim for ${displayValue(key, good)} or less. This is rated ${rating.replace("-", " ")}.`,
        severity: rating === "poor" ? "high" : "medium",
      },
    ];
  });

const metricKeyOf = (issueId: string) => issueId.split("-").at(-1) as MetricKey;

/** One fix per metric (mobile and desktop share a remedy), linked to its most severe issue. */
const fixesFor = (issues: Issue[]): Fix[] =>
  issues
    .toSorted(bySeverity)
    .filter((issue, i, all) => all.findIndex((o) => metricKeyOf(o.id) === metricKeyOf(issue.id)) === i)
    .map((issue) => ({ issueId: issue.id, priority: issue.severity, ...METRIC_FIXES[metricKeyOf(issue.id)] }));

const metricTable = (s: LighthouseSummary) =>
  Object.fromEntries(Object.entries(s.metrics).map(([k, m]) => [k, { value: m.value, display: m.display }]));

// ---------- Performance ----------

export const performanceResult = (lh: Partial<Record<FormFactor, LighthouseSummary>>): CategoryResult => {
  const mobile = lh.mobile?.scores.performance ?? null;
  const desktop = lh.desktop?.scores.performance ?? null;
  const score =
    mobile !== null && desktop !== null ? clampScore(mobile * 0.6 + desktop * 0.4) : (mobile ?? desktop);

  const issues = [lh.mobile, lh.desktop].flatMap((s) => (s ? metricIssues(s) : [])).toSorted(bySeverity);
  const parts = [mobile !== null && `mobile ${mobile}`, desktop !== null && `desktop ${desktop}`].filter(Boolean);

  return {
    category: "performance",
    score,
    status: mobile !== null && desktop !== null ? "COMPLETE" : score === null ? "FAILED" : "PARTIAL",
    summary:
      score === null
        ? "Lighthouse couldn't measure performance."
        : `Lighthouse performance: ${parts.join(", ")}. ${issues.length === 0 ? "All Core Web Vitals look healthy." : `${issues.length} metric${issues.length === 1 ? "" : "s"} need attention.`}`,
    issues,
    fixes: fixesFor(issues),
    toolsUsed: [...CATEGORIES.performance.tools],
    metrics: { mobile: lh.mobile && metricTable(lh.mobile), desktop: lh.desktop && metricTable(lh.desktop) },
  };
};

// ---------- Device-wise performance ----------

const RATING_RANK: Record<Rating, number> = { good: 0, "needs-improvement": 1, poor: 2 };

export const devicePerformanceResult = (lh: Partial<Record<FormFactor, LighthouseSummary>>): CategoryResult => {
  const { mobile, desktop } = lh;
  const mScore = mobile?.scores.performance ?? null;
  const dScore = desktop?.scores.performance ?? null;
  const scores = [mScore, dScore].filter((s): s is number => s !== null);
  const score = scores.length ? Math.min(...scores) : null;

  const gaps: Issue[] =
    mobile && desktop
      ? (Object.keys(METRIC_THRESHOLDS) as MetricKey[]).flatMap((key) => {
          const m = rateMetric(key, mobile.metrics[key].value);
          const d = rateMetric(key, desktop.metrics[key].value);
          if (RATING_RANK[m] <= RATING_RANK[d]) return [];
          return [
            {
              id: `gap-${key}`,
              title: `${METRIC_THRESHOLDS[key].label}: ${displayValue(key, mobile.metrics[key].value)} on mobile vs ${displayValue(key, desktop.metrics[key].value)} on desktop`,
              detail: "Mobile visitors on slower devices and networks get a noticeably worse experience.",
              severity: m === "poor" ? "high" : "medium",
            },
          ];
        })
      : [];
  const gap = mScore !== null && dScore !== null ? dScore - mScore : 0;

  return {
    category: "devicePerformance",
    score,
    status: mobile && desktop ? "COMPLETE" : score === null ? "FAILED" : "PARTIAL",
    summary:
      mScore !== null && dScore !== null
        ? gap > 10
          ? `Mobile scores ${gap} points below desktop (${mScore} vs ${dScore}).`
          : `Mobile (${mScore}) and desktop (${dScore}) perform similarly.`
        : "Only one device profile could be measured.",
    issues: gaps,
    fixes: fixesFor(gaps),
    toolsUsed: [...CATEGORIES.devicePerformance.tools],
    metrics: {
      mobile: mobile && { score: mScore, ...metricTable(mobile) },
      desktop: desktop && { score: dScore, ...metricTable(desktop) },
    },
  };
};

// ---------- Slow-loading items ----------

const SLOW_AUDIT_FIXES: Record<string, Pick<Fix, "title" | "steps" | "effort" | "effortHint">> = {
  "render-blocking-insight": {
    title: "Remove render-blocking resources",
    steps: "Inline critical CSS, load the rest with media queries or preload, and add defer or async to scripts in <head>.",
    effort: "M",
    effortHint: "~half a day",
  },
  "third-parties-insight": {
    title: "Tame third-party scripts",
    steps: "Audit each third party for value, load the rest after interaction (facades for chat widgets and video embeds), and self-host where licences allow.",
    effort: "M",
    effortHint: "~half a day",
  },
  "image-delivery-insight": {
    title: "Serve smaller, modern images",
    steps: "Convert to AVIF/WebP, resize to the rendered size with srcset/sizes, and compress (quality 70–80 is usually indistinguishable).",
    effort: "S",
    effortHint: "~1–2 hours",
  },
  "unused-javascript": {
    title: "Ship less JavaScript",
    steps: "Code-split by route, tree-shake imports, and drop libraries that are loaded on every page but used on few.",
    effort: "L",
    effortHint: "1–2 days",
  },
  "unused-css-rules": {
    title: "Remove unused CSS",
    steps: "Purge unused selectors at build time (e.g. Tailwind/PurgeCSS) and split page-specific styles.",
    effort: "M",
    effortHint: "~half a day",
  },
  "total-byte-weight": {
    title: "Reduce total page weight",
    steps: "Start with the largest resources listed below: compress images, lazy-load media below the fold, and trim fonts to the weights you use.",
    effort: "M",
    effortHint: "~half a day",
  },
  "cache-insight": {
    title: "Cache static assets for longer",
    steps: "Serve fingerprinted assets with Cache-Control: public, max-age=31536000, immutable.",
    effort: "S",
    effortHint: "~1 hour",
  },
  "lcp-discovery-insight": {
    title: "Make the LCP image discoverable early",
    steps: "Reference the hero image directly in the HTML (not via CSS or JS), add fetchpriority=\"high\", and remove loading=\"lazy\" from it.",
    effort: "S",
    effortHint: "~1 hour",
  },
  "font-display-insight": {
    title: "Show text while fonts load",
    steps: "Add font-display: swap (or optional) to @font-face rules and preload the primary font file.",
    effort: "S",
    effortHint: "~30 min",
  },
  "document-latency-insight": {
    title: "Speed up the HTML response",
    steps: "Avoid redirects, enable compression, and cache or pre-render the HTML at the edge.",
    effort: "M",
    effortHint: "~half a day",
  },
};
const GENERIC_SLOW_FIX = { steps: "Follow Lighthouse's guidance for this item, starting with the largest offenders listed.", effort: "M" as const };

export const SLOW_AUDIT_IDS = [
  ...Object.keys(SLOW_AUDIT_FIXES),
  "bootup-time",
  "network-dependency-tree-insight",
  "legacy-javascript-insight",
  "duplicated-javascript-insight",
  "unminified-javascript",
  "unminified-css",
];

const itemEvidence = (items: LighthouseSummary["audits"][string]["items"]) =>
  items
    .map((i) => [i.label, i.bytes && formatBytes(i.bytes), i.ms && formatMs(i.ms)].filter(Boolean).join(" · "))
    .join("\n");

export const slowLoadingResult = (lh: Partial<Record<FormFactor, LighthouseSummary>>): CategoryResult => {
  const source = lh.mobile ?? lh.desktop;
  if (!source) {
    return {
      category: "slowLoading",
      score: null,
      status: "FAILED",
      summary: "Lighthouse couldn't analyse the page's resources.",
      issues: [],
      fixes: [],
      toolsUsed: [...CATEGORIES.slowLoading.tools],
    };
  }

  const audits = SLOW_AUDIT_IDS.flatMap((id) => (source.audits[id] ? [source.audits[id]] : []));
  const scored = audits.filter((a) => a.score !== null);
  const score = scored.length ? clampScore((scored.reduce((s, a) => s + (a.score ?? 0), 0) / scored.length) * 100) : 100;
  const failing = audits.filter((a) => a.score !== null && a.score < 0.9);

  const issues: Issue[] = failing
    .map((a) => ({
      id: a.id,
      title: a.displayValue ? `${a.title} (${a.displayValue})` : a.title,
      detail: firstSentence(a.description),
      severity: severityFromScore(a.score),
      evidence: itemEvidence(a.items) || undefined,
    }))
    .toSorted(bySeverity);

  const biggest = source.largestRequests[0];
  return {
    category: "slowLoading",
    score,
    status: "COMPLETE",
    summary:
      issues.length === 0
        ? "No significant slow-loading resources found."
        : `${issues.length} resource problem${issues.length === 1 ? "" : "s"} found${biggest?.bytes ? `; the largest request is ${formatBytes(biggest.bytes)}` : ""}.`,
    issues,
    fixes: issues.map((issue) => {
      const fix = SLOW_AUDIT_FIXES[issue.id];
      return { issueId: issue.id, priority: issue.severity, title: fix?.title ?? issue.title, ...(fix ?? GENERIC_SLOW_FIX) };
    }),
    toolsUsed: [...CATEGORIES.slowLoading.tools],
    metrics: {
      largestRequests: source.largestRequests.map((r) => ({ url: r.label, size: r.bytes ? formatBytes(r.bytes) : null })),
    },
  };
};
