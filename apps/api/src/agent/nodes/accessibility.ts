import { AxeBuilder } from "@axe-core/playwright";
import { accessibilityResult, type AxeViolation } from "../categories/accessibility";
import type { NodeOutcome } from "../safe-node";
import type { AuditStateType } from "../state";
import { getLighthouse } from "../tools/lighthouse";
import type { AgentContext } from "../types";
import { plural, saveResults } from "./shared";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const IMPACTS = new Set(["critical", "serious", "moderate", "minor"]);

const runAxe = (ctx: AgentContext, url: string) =>
  ctx.browser.withPage(url, { viewport: { width: 1280, height: 900 } }, async (page): Promise<AxeViolation[]> => {
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    return violations.map((v) => ({
      id: v.id,
      impact: (v.impact && IMPACTS.has(v.impact) ? v.impact : "moderate") as AxeViolation["impact"],
      help: v.help,
      description: v.description,
      helpUrl: v.helpUrl,
      nodeCount: v.nodes.length,
      targets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
    }));
  });

export const accessibilityNode = (ctx: AgentContext) => async (state: AuditStateType): Promise<NodeOutcome> => {
  const url = state.crawledPages[0]?.url ?? ctx.url;

  await ctx.emit({ type: "tool_called", node: "accessibility", message: "Running axe-core WCAG 2.2 rules", data: { tool: "axe" } });
  const violations = await runAxe(ctx, url).catch(async (error: unknown) => {
    await ctx.emit({ type: "error", node: "accessibility", message: `axe-core failed: ${String(error)}`, data: { recoverable: true } });
    return null;
  });

  const missingAlt = violations?.find((v) => v.id === "image-alt");
  if (missingAlt) {
    await ctx.emit({ type: "finding", node: "accessibility", message: `Found ${plural(missingAlt.nodeCount, "image")} without alt text`, data: { severity: "high" } });
  }
  const contrast = violations?.find((v) => v.id === "color-contrast");
  if (contrast) {
    await ctx.emit({ type: "finding", node: "accessibility", message: `${plural(contrast.nodeCount, "element")} with low colour contrast`, data: { severity: "medium" } });
  }
  if (violations) {
    await ctx.emit({ type: "finding", node: "accessibility", message: `axe-core: ${plural(violations.length, "rule")} failing`, data: { severity: violations.length ? "medium" : "info" } });
  }

  await ctx.emit({ type: "tool_called", node: "accessibility", message: "Reading the Lighthouse accessibility audit", data: { tool: "lighthouse" } });
  const lighthouseScore = await getLighthouse(ctx.url, "mobile")
    .then((s) => s.scores.accessibility)
    .catch(() => null);

  if (violations === null && lighthouseScore === null) throw new Error("Neither axe-core nor Lighthouse could run");
  const result = accessibilityResult(lighthouseScore, violations);
  return { update: await saveResults(ctx, [result]), summary: "Accessibility scan done" };
};
