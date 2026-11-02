import { setTimeout as sleep } from "node:timers/promises";
import { CATEGORIES, type CategoryId, type CategoryResult, type UiIdea } from "@sitescope/shared";
import type { EmitInput } from "../events/bus";
import { saveCategoryResult } from "../jobs/results";
import type { AuditJob, AuditRunner } from "../jobs/types";

/** Placeholder "screenshot": an inline SVG of a page wireframe at the given width. */
const mockScreenshot = (width: number) => {
  const height = Math.round(width * 0.62);
  const columns = width >= 1024 ? 3 : width >= 768 ? 2 : 1;
  const colWidth = (width - 40 - (columns - 1) * 16) / columns;
  const cards = Array.from({ length: columns }, (_, i) =>
    `<rect x="${20 + i * (colWidth + 16)}" y="${height * 0.45}" width="${colWidth}" height="${height * 0.4}" rx="8" fill="#cbd5e1"/>`,
  ).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#f8fafc"/><rect width="100%" height="${height * 0.1}" fill="#6366f1"/><rect x="20" y="${height * 0.18}" width="${width * 0.6}" height="${height * 0.08}" rx="6" fill="#334155"/><rect x="20" y="${height * 0.3}" width="${width * 0.4}" height="${height * 0.05}" rx="6" fill="#94a3b8"/>${cards}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
};

const mockResult = (category: CategoryId, score: number, summary: string, issueTitle: string, fixTitle: string): CategoryResult => ({
  category,
  score,
  status: "COMPLETE",
  summary,
  issues: [
    { id: `${category}-1`, title: issueTitle, detail: `Mock finding for ${CATEGORIES[category].label}.`, severity: score < 60 ? "high" : "medium" },
  ],
  fixes: [
    { issueId: `${category}-1`, title: fixTitle, steps: "Mock fix steps. Real recommendations arrive in Phase 4–5.", priority: score < 60 ? "high" : "medium", effort: "M", effortHint: "~2h" },
  ],
  toolsUsed: [...CATEGORIES[category].tools],
});

const MOCK_RESULTS: Record<CategoryId, CategoryResult> = {
  performance: mockResult("performance", 72, "LCP is slow on mobile; desktop is fine.", "Largest Contentful Paint 3.8s on mobile", "Preload and compress the hero image"),
  devicePerformance: mockResult("devicePerformance", 64, "Mobile scores 28 points below desktop.", "Mobile TBT is 4× desktop", "Defer non-critical JavaScript on mobile"),
  slowLoading: mockResult("slowLoading", 58, "Three resources dominate load time.", "hero.jpg is 1.4 MB", "Serve hero.jpg as AVIF at 1600px"),
  accessibility: mockResult("accessibility", 81, "Mostly accessible; a few contrast and label issues.", "12 images without alt text", "Add descriptive alt text"),
  responsiveness: mockResult("responsiveness", 88, "Layout adapts well; one overflow at 375px.", "Horizontal overflow at 375px", "Constrain the pricing table width"),
  seo: mockResult("seo", 90, "Strong fundamentals; missing OG image.", "No og:image tag", "Add a 1200×630 og:image"),
  aeo: mockResult("aeo", 55, "Few question-style headings or FAQ markup.", "No FAQPage structured data", "Add an FAQ section with JSON-LD"),
  geo: mockResult("geo", 62, "Content is clear but light on citations.", "No llms.txt file", "Publish /llms.txt summarising key pages"),
  grammar: mockResult("grammar", 94, "Two minor issues after filtering false positives.", "\"it's\" used for \"its\"", "Correct the possessive on the About page"),
  features: mockResult("features", 70, "Missing a few features common to similar sites.", "No customer testimonials", "Add a testimonials section near the CTA"),
};

const MOCK_IDEAS: UiIdea[] = [
  { title: "Sticky call-to-action on mobile", description: "Keep the primary CTA reachable as users scroll long pages.", impact: "high", effort: "S" },
  { title: "Dark mode", description: "Respect prefers-color-scheme for comfortable night reading.", impact: "medium", effort: "M" },
];

type Step = { wait: number } & ({ event: EmitInput } | { result: CategoryId } | { screenshot: number });

const ev = (wait: number, event: EmitInput): Step => ({ wait, event });

/** A scripted run that mirrors the real graph, including interleaved events from the parallel nodes. */
const script = (url: string): Step[] => [
  ev(300, { type: "node_started", node: "validateUrl", message: `Validating ${url}` }),
  ev(500, { type: "node_completed", node: "validateUrl", message: "URL is public and reachable" }),
  ev(300, { type: "node_started", node: "crawl", message: "Crawling the homepage and key pages…" }),
  ev(600, { type: "tool_called", node: "crawl", message: "Fetching robots.txt and sitemap.xml", data: { tool: "crawler" } }),
  ev(900, { type: "finding", node: "crawl", message: "Discovered 5 key internal pages", data: { severity: "info" } }),
  ev(400, { type: "node_completed", node: "crawl", message: "Crawled 6 pages" }),
  ev(200, { type: "node_started", node: "lighthouse", message: "Starting Lighthouse" }),
  ev(100, { type: "node_started", node: "accessibility", message: "Starting accessibility scan" }),
  ev(100, { type: "node_started", node: "responsiveness", message: "Checking layouts across devices" }),
  ev(100, { type: "node_started", node: "seo", message: "Inspecting SEO signals" }),
  ev(100, { type: "node_started", node: "grammar", message: "Extracting visible text" }),
  ev(400, { type: "tool_called", node: "lighthouse", message: "Running Lighthouse on mobile…", data: { tool: "lighthouse" } }),
  ev(300, { type: "tool_called", node: "responsiveness", message: "Capturing screenshot at 375px", data: { tool: "playwright" } }),
  { wait: 700, screenshot: 375 },
  ev(300, { type: "tool_called", node: "accessibility", message: "Running axe-core rules", data: { tool: "axe" } }),
  ev(400, { type: "tool_called", node: "seo", message: "Checking titles, meta descriptions and canonicals", data: { tool: "crawler" } }),
  { wait: 500, screenshot: 768 },
  ev(300, { type: "finding", node: "accessibility", message: "Found 12 images without alt text", data: { severity: "high" } }),
  ev(400, { type: "tool_called", node: "grammar", message: "Checking 2,140 words with LanguageTool", data: { tool: "languageTool" } }),
  ev(500, { type: "finding", node: "seo", message: "No og:image tag on the homepage", data: { severity: "medium" } }),
  { wait: 400, screenshot: 1024 },
  ev(300, { type: "finding", node: "responsiveness", message: "Horizontal overflow detected at 375px", data: { severity: "medium" } }),
  { wait: 500, screenshot: 1440 },
  ev(300, { type: "tool_called", node: "responsiveness", message: "Claude is reviewing the screenshots", data: { tool: "claude" } }),
  { wait: 600, result: "seo" },
  ev(100, { type: "node_completed", node: "seo", message: "SEO checks done" }),
  ev(500, { type: "finding", node: "lighthouse", message: "LCP is 3.8s on mobile", data: { severity: "high" } }),
  ev(400, { type: "tool_called", node: "lighthouse", message: "Running Lighthouse on desktop…", data: { tool: "lighthouse" } }),
  { wait: 600, result: "accessibility" },
  ev(100, { type: "node_completed", node: "accessibility", message: "Accessibility scan done" }),
  ev(500, { type: "tool_called", node: "grammar", message: "Claude is filtering false positives", data: { tool: "claude" } }),
  { wait: 700, result: "responsiveness" },
  ev(100, { type: "node_completed", node: "responsiveness", message: "Responsiveness checks done" }),
  { wait: 500, result: "grammar" },
  ev(100, { type: "node_completed", node: "grammar", message: "Grammar check done" }),
  ev(600, { type: "finding", node: "lighthouse", message: "hero.jpg (1.4 MB) is the largest resource", data: { severity: "high" } }),
  { wait: 400, result: "performance" },
  { wait: 200, result: "devicePerformance" },
  { wait: 200, result: "slowLoading" },
  ev(100, { type: "node_completed", node: "lighthouse", message: "Lighthouse finished" }),
  ev(300, { type: "node_started", node: "llmAnalysis", message: "Claude is analysing content for GEO, AEO and features" }),
  ev(500, { type: "tool_called", node: "llmAnalysis", message: "Comparing against similar sites", data: { tool: "claude" } }),
  { wait: 1200, result: "aeo" },
  { wait: 400, result: "geo" },
  { wait: 400, result: "features" },
  ev(300, { type: "finding", node: "llmAnalysis", message: "Drafted 2 UI/UX improvement ideas", data: { severity: "info" } }),
  ev(200, { type: "node_completed", node: "llmAnalysis", message: "Content analysis done" }),
  ev(200, { type: "node_started", node: "scoreAggregator", message: "Calculating weighted overall score" }),
  ev(400, { type: "node_completed", node: "scoreAggregator", message: "Overall score calculated" }),
  ev(200, { type: "node_started", node: "reportWriter", message: "Writing the report" }),
  ev(400, { type: "node_completed", node: "reportWriter", message: "Report saved" }),
];

export const mockRun: AuditRunner = async ({ auditId, url, emit }: AuditJob) => {
  const screenshots: { width: number; url: string }[] = [];

  for (const step of script(url)) {
    await sleep(step.wait);
    if ("event" in step) await emit(step.event);
    else if ("result" in step) await saveCategoryResult(auditId, MOCK_RESULTS[step.result], emit);
    else {
      const shot = { width: step.screenshot, url: mockScreenshot(step.screenshot) };
      screenshots.push(shot);
      await emit({ type: "screenshot", node: "responsiveness", message: `Captured ${step.screenshot}px screenshot`, data: shot });
    }
  }

  return { uiIdeas: MOCK_IDEAS, screenshots };
};
