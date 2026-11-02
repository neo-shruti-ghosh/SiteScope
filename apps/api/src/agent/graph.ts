import { END, START, StateGraph } from "@langchain/langgraph";
import type { CategoryId } from "@sitescope/shared";
import { saveCategoryResult } from "../jobs/results";
import type { AuditRunner } from "../jobs/types";
import { accessibilityNode } from "./nodes/accessibility";
import { crawl } from "./nodes/crawl";
import { grammarNode } from "./nodes/grammar";
import { lighthouseNode } from "./nodes/lighthouse";
import { llmAnalysisNode } from "./nodes/llm-analysis";
import { reportWriterNode, scoreAggregatorNode } from "./nodes/report";
import { responsivenessNode } from "./nodes/responsiveness";
import { seoNode } from "./nodes/seo";
import { validateUrl } from "./nodes/validate-url";
import { safeNode } from "./safe-node";
import { AuditState } from "./state";
import { createBrowserHandle } from "./tools/browser";
import type { AgentContext } from "./types";

const PARALLEL_CHECKS = ["lighthouse", "accessibility", "responsiveness", "seo", "grammar"] as const;

/**
 * validateUrl → crawl → [lighthouse | accessibility | responsiveness | seo | grammar]
 *   → llmAnalysis → scoreAggregator → reportWriter
 */
export const buildAuditGraph = (ctx: AgentContext) =>
  new StateGraph(AuditState)
    .addNode("validateUrl", safeNode("validateUrl", ctx, validateUrl(ctx), { startMessage: `Validating ${ctx.url}`, fatal: true }))
    .addNode("crawl", safeNode("crawl", ctx, crawl(ctx), { startMessage: "Crawling the homepage and key pages…" }))
    .addNode("lighthouse", safeNode("lighthouse", ctx, lighthouseNode(ctx), { startMessage: "Starting Lighthouse" }))
    .addNode("accessibility", safeNode("accessibility", ctx, accessibilityNode(ctx), { startMessage: "Starting the accessibility scan" }))
    .addNode("responsiveness", safeNode("responsiveness", ctx, responsivenessNode(ctx), { startMessage: "Checking layouts across devices" }))
    .addNode("seo", safeNode("seo", ctx, seoNode(ctx), { startMessage: "Inspecting SEO signals" }))
    .addNode("grammar", safeNode("grammar", ctx, grammarNode(ctx), { startMessage: "Extracting visible text" }))
    .addNode("llmAnalysis", safeNode("llmAnalysis", ctx, llmAnalysisNode(ctx), { startMessage: "Analysing content for GEO, AEO and features" }))
    .addNode("scoreAggregator", safeNode("scoreAggregator", ctx, scoreAggregatorNode(ctx), { startMessage: "Calculating the weighted overall score" }))
    .addNode("reportWriter", safeNode("reportWriter", ctx, reportWriterNode(ctx), { startMessage: "Writing the report" }))
    .addEdge(START, "validateUrl")
    .addEdge("validateUrl", "crawl")
    .addEdge("crawl", "lighthouse")
    .addEdge("crawl", "accessibility")
    .addEdge("crawl", "responsiveness")
    .addEdge("crawl", "seo")
    .addEdge("crawl", "grammar")
    // Array source = join: llmAnalysis waits for all five parallel checks.
    .addEdge([...PARALLEL_CHECKS], "llmAnalysis")
    .addEdge("llmAnalysis", "scoreAggregator")
    .addEdge("scoreAggregator", "reportWriter")
    .addEdge("reportWriter", END)
    .compile();

export const runAuditGraph: AuditRunner = async ({ auditId, url, context, emit }) => {
  const browser = createBrowserHandle();
  const savedCategories = new Set<CategoryId>();
  const ctx: AgentContext = {
    auditId,
    url,
    userContext: context,
    emit,
    browser,
    savedCategories,
    saveResult: async (result) => {
      await saveCategoryResult(auditId, result, emit);
      savedCategories.add(result.category);
    },
  };

  try {
    const final = await buildAuditGraph(ctx).invoke({ url, userContext: context });
    return {
      uiIdeas: final.uiIdeas,
      screenshots: final.screenshots.map(({ width, url: shotUrl }) => ({ width, url: shotUrl })),
    };
  } finally {
    await browser.close();
  }
};
