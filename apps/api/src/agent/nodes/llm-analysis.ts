import { CATEGORIES, type CategoryResult } from "@sitescope/shared";
import { ContentAnalysisSchema, llmCategoryResult } from "../categories/llm";
import { contentSignals, siteDigest } from "../llm/digest";
import { CONTENT_ANALYSIS_SYSTEM, contentAnalysisPrompt } from "../llm/prompts";
import type { NodeOutcome } from "../safe-node";
import type { AuditStateType } from "../state";
import { askClaude, claudeEnabled } from "../tools/claude";
import type { AgentContext } from "../types";
import { plural, saveResults } from "./shared";

const CLAUDE_CATEGORIES = ["aeo", "geo", "features"] as const;

const notAnalysed = (reason: string): CategoryResult[] =>
  CLAUDE_CATEGORIES.map((category) => ({
    category,
    score: null,
    status: "FAILED",
    summary: `Not analysed: ${reason}`,
    issues: [],
    fixes: [],
    toolsUsed: [...CATEGORIES[category].tools],
  }));

/** One structured Claude call covers AEO, GEO, missing features and UI/UX ideas. */
export const llmAnalysisNode = (ctx: AgentContext) => async (state: AuditStateType): Promise<NodeOutcome> => {
  if (!claudeEnabled()) {
    await ctx.emit({ type: "finding", node: "llmAnalysis", message: "No ANTHROPIC_API_KEY set, so Claude analysis is skipped", data: { severity: "info" } });
    return { update: { ...(await saveResults(ctx, notAnalysed("Claude analysis isn't configured."))), uiIdeas: [] }, summary: "Content analysis skipped" };
  }
  if (state.crawledPages.length === 0) throw new Error("No crawled content to analyse");

  const signals = contentSignals(state.crawledPages, state.siteFiles);
  await ctx.emit({
    type: "finding",
    node: "llmAnalysis",
    message: `${plural(signals.questionHeadings.length, "question-style heading")}, ${signals.schemaTypes.length ? `schema: ${signals.schemaTypes.slice(0, 4).join(", ")}` : "no structured data"}`,
    data: { severity: "info" },
  });
  await ctx.emit({
    type: "tool_called",
    node: "llmAnalysis",
    message: "Claude is analysing content for AEO, GEO and missing features",
    data: { tool: "claude" },
  });

  const analysis = await askClaude(
    ContentAnalysisSchema,
    "content_analysis",
    CONTENT_ANALYSIS_SYSTEM,
    contentAnalysisPrompt(ctx.userContext, ctx.url, siteDigest(state.crawledPages, state.siteFiles)),
  );

  const results = CLAUDE_CATEGORIES.map((c) => llmCategoryResult(c, analysis[c], c === "features" ? undefined : { signals }));
  const top = results.flatMap((r) => r.issues.filter((i) => i.severity === "high").map((i) => `${CATEGORIES[r.category].label}: ${i.title}`));
  await Promise.all(
    top.slice(0, 3).map((message) => ctx.emit({ type: "finding", node: "llmAnalysis", message, data: { severity: "high" } })),
  );
  await ctx.emit({
    type: "finding",
    node: "llmAnalysis",
    message: `Drafted ${plural(analysis.uiIdeas.length, "UI/UX idea")}`,
    data: { severity: "info" },
  });

  return {
    update: { ...(await saveResults(ctx, results)), uiIdeas: analysis.uiIdeas.slice(0, 6) },
    summary: "Content analysis done",
  };
};
