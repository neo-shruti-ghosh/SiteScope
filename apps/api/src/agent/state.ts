import { Annotation } from "@langchain/langgraph";
import type { CategoryId, CategoryResult, UiIdea } from "@sitescope/shared";
import type { LighthouseSummary } from "./tools/lighthouse";
import type { CrawledPage, Screenshot, SiteFiles } from "./types";

const replace = <T>(fallback: () => T) => Annotation<T>({ reducer: (_prev, next) => next, default: fallback });

export const AuditState = Annotation.Root({
  url: Annotation<string>,
  userContext: Annotation<string>,
  crawledPages: replace<CrawledPage[]>(() => []),
  siteFiles: replace<SiteFiles>(() => ({ robotsTxt: null, sitemapFound: false, llmsTxt: null })),
  lighthouseReports: Annotation<Partial<Record<"mobile" | "desktop", LighthouseSummary>>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),
  screenshots: Annotation<Screenshot[]>({ reducer: (prev, next) => [...prev, ...next], default: () => [] }),
  // Parallel nodes each add their own categories; merging keeps them from clobbering each other.
  categoryResults: Annotation<Partial<Record<CategoryId, CategoryResult>>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),
  uiIdeas: replace<UiIdea[]>(() => []),
  overallScore: replace<number | null>(() => null),
});

export type AuditStateType = typeof AuditState.State;
export type AuditStateUpdate = typeof AuditState.Update;
