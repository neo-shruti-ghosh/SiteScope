import type { CategoryId, CategoryResult } from "@sitescope/shared";
import type { Emit } from "../events/bus";
import type { BrowserHandle } from "./tools/browser";

export interface CrawledPage {
  url: string;
  title: string;
  metaDescription: string | null;
  lang: string | null;
  canonical: string | null;
  viewportMeta: string | null;
  headings: { level: number; text: string }[];
  links: string[];
  images: { src: string; alt: string | null }[];
  og: Record<string, string>;
  jsonLd: unknown[];
  text: string;
  wordCount: number;
}

export interface SiteFiles {
  robotsTxt: string | null;
  sitemapFound: boolean;
  llmsTxt: string | null;
}

export interface Screenshot {
  width: number;
  url: string;
  /** Local file path, for later analysis (e.g. Claude vision). */
  path: string;
}

/** Everything a node needs besides graph state. Built once per audit run. */
export interface AgentContext {
  auditId: string;
  url: string;
  userContext: string;
  emit: Emit;
  /** Lazily launched, shared Playwright browser whose contexts block private-network requests. */
  browser: BrowserHandle;
  /** Persists a category result, announces it, and records it as saved. */
  saveResult: (result: CategoryResult) => Promise<void>;
  savedCategories: Set<CategoryId>;
}
