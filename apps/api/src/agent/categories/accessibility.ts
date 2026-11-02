import { CATEGORIES, type CategoryResult, type Issue } from "@sitescope/shared";
import { bySeverity, clampScore } from "./format";

export interface AxeViolation {
  id: string;
  impact: "critical" | "serious" | "moderate" | "minor";
  help: string;
  description: string;
  helpUrl: string;
  nodeCount: number;
  targets: string[];
}

const IMPACT_PENALTY: Record<AxeViolation["impact"], number> = { critical: 15, serious: 10, moderate: 5, minor: 2 };
const IMPACT_SEVERITY: Record<AxeViolation["impact"], Issue["severity"]> = {
  critical: "high",
  serious: "high",
  moderate: "medium",
  minor: "low",
};

/** Each failing rule costs points by impact, regardless of how many elements fail it. */
export const axeScore = (violations: readonly AxeViolation[]) =>
  clampScore(100 - violations.reduce((sum, v) => sum + IMPACT_PENALTY[v.impact], 0));

export const accessibilityResult = (lighthouseScore: number | null, violations: AxeViolation[] | null): CategoryResult => {
  const axe = violations === null ? null : axeScore(violations);
  const parts = [lighthouseScore, axe].filter((s): s is number => s !== null);
  const score = parts.length ? clampScore(parts.reduce((a, b) => a + b, 0) / parts.length) : null;

  const issues: Issue[] = (violations ?? [])
    .map((v) => ({
      id: v.id,
      title: `${v.help} (${v.nodeCount} element${v.nodeCount === 1 ? "" : "s"})`,
      detail: v.description,
      severity: IMPACT_SEVERITY[v.impact],
      evidence: v.targets.slice(0, 3).join("\n") || undefined,
    }))
    .toSorted(bySeverity);

  const critical = (violations ?? []).filter((v) => v.impact === "critical" || v.impact === "serious").length;
  return {
    category: "accessibility",
    score,
    status: lighthouseScore !== null && axe !== null ? "COMPLETE" : score === null ? "FAILED" : "PARTIAL",
    summary:
      score === null
        ? "Accessibility couldn't be measured."
        : issues.length === 0
          ? "No automated accessibility violations found. Manual keyboard and screen-reader testing is still worthwhile."
          : `${issues.length} WCAG rule${issues.length === 1 ? "" : "s"} failing${critical ? `, ${critical} of them serious or critical` : ""}.`,
    issues,
    fixes: (violations ?? []).map((v) => ({
      issueId: v.id,
      title: v.help,
      steps: `${v.description.replace(/\.?$/, ".")} Update the ${v.nodeCount} affected element${v.nodeCount === 1 ? "" : "s"} listed under "Found on your site".`,
      learnMoreUrl: v.helpUrl,
      priority: IMPACT_SEVERITY[v.impact],
      effort: v.nodeCount > 10 ? "M" : "S",
      effortHint: v.nodeCount > 10 ? "~half a day" : "~1 hour",
    })),
    toolsUsed: [...CATEGORIES.accessibility.tools],
    metrics: { lighthouse: lighthouseScore, axe },
  };
};
