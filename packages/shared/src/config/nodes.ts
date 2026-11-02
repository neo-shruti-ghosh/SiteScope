import type { NodeId } from "../schemas/events";
import type { CategoryId } from "./categories";

export interface NodeConfig {
  label: string;
  /** Categories this node scores; their chips flip to "scanning" when the node starts. */
  categories: readonly CategoryId[];
}

export const NODES: Record<NodeId, NodeConfig> = {
  validateUrl: { label: "Validate URL", categories: [] },
  crawl: { label: "Crawl", categories: [] },
  lighthouse: { label: "Lighthouse", categories: ["performance", "devicePerformance", "slowLoading"] },
  accessibility: { label: "Accessibility", categories: ["accessibility"] },
  responsiveness: { label: "Responsiveness", categories: ["responsiveness"] },
  seo: { label: "SEO", categories: ["seo"] },
  grammar: { label: "Grammar", categories: ["grammar"] },
  llmAnalysis: { label: "Claude analysis", categories: ["aeo", "geo", "features"] },
  scoreAggregator: { label: "Score", categories: [] },
  reportWriter: { label: "Report", categories: [] },
};

/** Graph stages in order; nodes within a stage run in parallel. */
export const PIPELINE_STAGES: readonly (readonly NodeId[])[] = [
  ["validateUrl"],
  ["crawl"],
  ["lighthouse", "accessibility", "responsiveness", "seo", "grammar"],
  ["llmAnalysis"],
  ["scoreAggregator"],
  ["reportWriter"],
];
