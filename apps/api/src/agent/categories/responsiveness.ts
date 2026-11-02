import { CATEGORIES, type CategoryResult, type Fix, type Issue } from "@sitescope/shared";
import { z } from "zod";
import { bySeverity, clampScore } from "./format";
import { findingsToIssuesAndFixes, LlmFindingSchema } from "./llm";

export interface ViewportCheck {
  width: number;
  overflowPx: number;
  overflowingElements: string[];
  smallTapTargets: number;
  smallTapExamples: string[];
  smallTextCount: number;
}

export interface ResponsivenessInput {
  viewportMeta: string | null;
  checks: ViewportCheck[];
}

/** One detected problem: what to show, how to fix it, and how many points it costs. */
interface Finding {
  issue: Issue;
  fix?: Omit<Fix, "issueId">;
  penalty: number;
}

const MOBILE_MAX = 767;

const viewportFindings = (viewportMeta: string | null): Finding[] =>
  viewportMeta?.includes("width=device-width")
    ? []
    : [
        {
          penalty: 30,
          issue: {
            id: "viewport-meta",
            title: viewportMeta ? "Viewport meta tag doesn't use width=device-width" : "No viewport meta tag",
            detail: "Without it, phones render the page at desktop width and shrink it, making text tiny.",
            severity: "high",
            evidence: viewportMeta ?? undefined,
          },
          fix: {
            title: "Add a responsive viewport meta tag",
            steps: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the <head> of every page.',
            priority: "high",
            effort: "S",
            effortHint: "~5 min",
          },
        },
      ];

const overflowFindings = (checks: ViewportCheck[]): Finding[] =>
  checks
    .filter((c) => c.overflowPx > 1)
    .map((c, i) => ({
      penalty: c.width <= MOBILE_MAX ? 15 : 8,
      issue: {
        id: `overflow-${c.width}`,
        title: `Content overflows horizontally at ${c.width}px (${c.overflowPx}px too wide)`,
        detail: "Visitors have to scroll sideways, which feels broken on touch devices.",
        severity: c.width <= MOBILE_MAX ? "high" : "medium",
        evidence: c.overflowingElements.join("\n") || undefined,
      },
      // One shared fix for all overflowing widths.
      fix:
        i === 0
          ? {
              title: "Contain wide elements",
              steps:
                "Give images and media max-width: 100%, let tables scroll inside an overflow-x: auto wrapper, replace fixed pixel widths with max-width or flex/grid, and check long unbroken strings (overflow-wrap: anywhere).",
              priority: "high",
              effort: "M",
              effortHint: "~2–4 hours",
            }
          : undefined,
    }));

const mobileFindings = (mobile: ViewportCheck | undefined): Finding[] => [
  ...(mobile && mobile.smallTapTargets > 0
    ? [
        {
          penalty: Math.min(20, mobile.smallTapTargets * 2),
          issue: {
            id: "tap-targets",
            title: `${mobile.smallTapTargets} tap target${mobile.smallTapTargets === 1 ? " is" : "s are"} smaller than 24×24px on mobile`,
            detail: "Small links and buttons are hard to hit accurately with a finger (WCAG 2.5.8).",
            severity: mobile.smallTapTargets > 5 ? ("medium" as const) : ("low" as const),
            evidence: mobile.smallTapExamples.join("\n") || undefined,
          },
          fix: {
            title: "Enlarge small tap targets",
            steps: "Give interactive elements at least 24×24px (ideally 44×44px) via padding, and space adjacent targets apart.",
            priority: "medium" as const,
            effort: "S" as const,
            effortHint: "~1–2 hours",
          },
        },
      ]
    : []),
  ...(mobile && mobile.smallTextCount > 0
    ? [
        {
          penalty: Math.min(10, mobile.smallTextCount),
          issue: {
            id: "small-text",
            title: `${mobile.smallTextCount} text block${mobile.smallTextCount === 1 ? " uses" : "s use"} a font smaller than 12px on mobile`,
            detail: "Tiny text forces pinch-zooming and hurts readability.",
            severity: "low" as const,
          },
          fix: {
            title: "Raise the minimum font size",
            steps: "Use at least 16px for body text and 12px for captions on small screens.",
            priority: "low" as const,
            effort: "S" as const,
            effortHint: "~30 min",
          },
        },
      ]
    : []),
];

export const responsivenessResult = ({ viewportMeta, checks }: ResponsivenessInput): CategoryResult => {
  const findings = [
    ...viewportFindings(viewportMeta),
    ...overflowFindings(checks),
    ...mobileFindings(checks.find((c) => c.width <= MOBILE_MAX)),
  ];
  const score = checks.length ? clampScore(100 - findings.reduce((sum, f) => sum + f.penalty, 0)) : null;

  return {
    category: "responsiveness",
    score,
    status: checks.length === 4 ? "COMPLETE" : checks.length ? "PARTIAL" : "FAILED",
    summary:
      checks.length === 0
        ? "No viewport could be rendered."
        : findings.length === 0
          ? `Layout holds up at all ${checks.length} tested widths.`
          : `${findings.length} layout issue${findings.length === 1 ? "" : "s"} across ${checks.map((c) => `${c.width}px`).join(", ")}.`,
    issues: findings.map((f) => f.issue).toSorted(bySeverity),
    fixes: findings.flatMap((f) => (f.fix ? [{ issueId: f.issue.id, ...f.fix }] : [])),
    toolsUsed: CATEGORIES.responsiveness.tools.filter((t) => t !== "claude"),
    metrics: { viewportMeta, checks },
  };
};

// ---------- Claude vision review ----------

export const VisualReviewSchema = z.object({
  visualScore: z.number().describe("0-100 visual quality of the responsive design across the screenshots"),
  summary: z.string().describe("One sentence on how the design holds up across sizes"),
  findings: z.array(LlmFindingSchema).describe("Visible problems, each naming the width; most impactful first, at most 6"),
});
export type VisualReview = z.infer<typeof VisualReviewSchema>;

/** Measured checks carry most of the weight; Claude's visual review adjusts the score and adds what it saw. */
const MEASURED_WEIGHT = 0.6;

export const withVisualReview = (measured: CategoryResult, review: VisualReview): CategoryResult => {
  const visual = findingsToIssuesAndFixes("visual", review.findings);
  const visualScore = clampScore(review.visualScore);
  return {
    ...measured,
    score: measured.score === null ? visualScore : clampScore(measured.score * MEASURED_WEIGHT + visualScore * (1 - MEASURED_WEIGHT)),
    summary: `${measured.summary} ${review.summary}`,
    issues: [...measured.issues, ...visual.issues].toSorted(bySeverity),
    fixes: [...measured.fixes, ...visual.fixes],
    toolsUsed: [...CATEGORIES.responsiveness.tools],
    metrics: { ...measured.metrics, measuredScore: measured.score, visualScore },
  };
};
