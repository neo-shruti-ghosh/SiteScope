import { overallScore, toGrade } from "@sitescope/shared";
import type { NodeOutcome } from "../safe-node";
import type { AuditStateType } from "../state";
import type { AgentContext } from "../types";
import { plural } from "./shared";

export const scoreAggregatorNode = (ctx: AgentContext) => async (state: AuditStateType): Promise<NodeOutcome> => {
  const results = Object.values(state.categoryResults);
  const score = overallScore(results);
  const unscored = results.filter((r) => r.score === null).length;
  if (unscored) {
    await ctx.emit({
      type: "finding",
      node: "scoreAggregator",
      message: `${plural(unscored, "category", "categories")} couldn't be scored and ${unscored === 1 ? "is" : "are"} left out of the overall score`,
      data: { severity: "low" },
    });
  }
  return {
    update: { overallScore: score },
    summary: score === null ? "No categories could be scored" : `Overall score ${score}/100 (grade ${toGrade(score)})`,
  };
};

export const reportWriterNode = (ctx: AgentContext) => async (state: AuditStateType): Promise<NodeOutcome> => {
  const results = Object.values(state.categoryResults);
  const issues = results.reduce((n, r) => n + r.issues.length, 0);
  const highPriority = results.reduce((n, r) => n + r.fixes.filter((f) => f.priority === "high").length, 0);
  await ctx.emit({
    type: "finding",
    node: "reportWriter",
    message: `${plural(issues, "issue")} found, ${plural(highPriority, "high-priority fix", "high-priority fixes")}`,
    data: { severity: "info" },
  });
  return { update: {}, summary: "Report ready" };
};
