import type { NodeId } from "@sitescope/shared";

const MINUTE = 60_000;

/** Per-node time budget. Lighthouse-dependent nodes wait in a queue, so they get the most. */
export const NODE_TIMEOUTS_MS: Record<NodeId, number> = {
  validateUrl: 0.5 * MINUTE,
  crawl: 2 * MINUTE,
  lighthouse: 5 * MINUTE,
  accessibility: 5 * MINUTE,
  responsiveness: 3 * MINUTE,
  seo: 5 * MINUTE,
  // LanguageTool (up to 45s) plus one AI call, which may fall back through several Gemini models.
  grammar: 4 * MINUTE,
  llmAnalysis: 3 * MINUTE,
  scoreAggregator: 0.5 * MINUTE,
  reportWriter: 0.5 * MINUTE,
};

export const CRAWL_MAX_PAGES = 5;
export const SCREENSHOT_WIDTHS = [375, 768, 1024, 1440] as const;
export const PAGE_LOAD_TIMEOUT_MS = 30_000;
