import { seoChecks, seoResult } from "../categories/seo";
import type { NodeOutcome } from "../safe-node";
import type { AuditStateType } from "../state";
import { getLighthouse } from "../tools/lighthouse";
import type { AgentContext } from "../types";
import { saveResults } from "./shared";

export const seoNode = (ctx: AgentContext) => async (state: AuditStateType): Promise<NodeOutcome> => {
  await ctx.emit({ type: "tool_called", node: "seo", message: "Checking titles, meta descriptions, headings and canonicals", data: { tool: "crawler" } });
  const failed = seoChecks(state.crawledPages, state.siteFiles).filter((c) => !c.passed);
  await Promise.all(
    failed
      .filter((c) => c.severity !== "low")
      .slice(0, 3)
      .map((c) => ctx.emit({ type: "finding", node: "seo", message: c.title, data: { severity: c.severity } })),
  );

  await ctx.emit({ type: "tool_called", node: "seo", message: "Reading the Lighthouse SEO audit", data: { tool: "lighthouse" } });
  const lighthouseScore = await getLighthouse(ctx.url, "mobile")
    .then((s) => s.scores.seo)
    .catch(() => null);

  if (state.crawledPages.length === 0 && lighthouseScore === null) throw new Error("No crawl data and no Lighthouse SEO score");
  const result = seoResult(lighthouseScore, state.crawledPages, state.siteFiles);
  return { update: await saveResults(ctx, [result]), summary: "SEO checks done" };
};
