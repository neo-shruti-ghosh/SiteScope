import { CATEGORIES, type CategoryId, type CategoryResult, Effort, Priority, UiIdeaSchema } from "@sitescope/shared";
import { z } from "zod";
import { bySeverity, clampScore } from "./format";

// Structured-output schemas avoid optional fields and numeric bounds (not reliably supported);
// nullable stands in for optional, and scores are clamped after parsing.

export const LlmFindingSchema = z.object({
  title: z.string().describe("Short, specific problem statement (under 90 characters)"),
  detail: z.string().describe("Why it matters for this site's goals, in 1-2 sentences"),
  severity: Priority,
  evidence: z.string().nullable().describe("Quote or concrete observation from the site, or null"),
  fix: z.object({
    title: z.string().describe("Imperative action, e.g. 'Add an FAQ section with FAQPage schema'"),
    steps: z.string().describe("Concrete steps tailored to this site, 1-4 sentences"),
    effort: Effort.describe("S = under 2 hours, M = half a day to a day, L = several days"),
    effortHint: z.string().describe("Human estimate, e.g. '~2 hours'"),
  }),
});

export const LlmCategorySchema = z.object({
  score: z.number().describe("0-100. 90+ excellent, 70-89 good, 50-69 needs work, below 50 poor"),
  summary: z.string().describe("One or two sentences a site owner can act on"),
  findings: z.array(LlmFindingSchema).describe("Most impactful first, at most 6"),
});

export const ContentAnalysisSchema = z.object({
  aeo: LlmCategorySchema,
  geo: LlmCategorySchema,
  features: LlmCategorySchema,
  uiIdeas: z.array(UiIdeaSchema).describe("3 to 6 UI/UX improvements or new features, most valuable first"),
});

export type LlmFinding = z.infer<typeof LlmFindingSchema>;
export type LlmCategory = z.infer<typeof LlmCategorySchema>;
export type ContentAnalysis = z.infer<typeof ContentAnalysisSchema>;

const MAX_FINDINGS = 6;

/** Turns Claude findings into issues and fixes that link to each other by id. */
export const findingsToIssuesAndFixes = (prefix: string, findings: LlmFinding[]) => {
  const ranked = findings.slice(0, MAX_FINDINGS).map((f, i) => ({ ...f, id: `${prefix}-${i + 1}` }));
  return {
    issues: ranked
      .map((f) => ({ id: f.id, title: f.title, detail: f.detail, severity: f.severity, evidence: f.evidence ?? undefined }))
      .toSorted(bySeverity),
    fixes: ranked.map((f) => ({ issueId: f.id, priority: f.severity, ...f.fix })),
  };
};

export const llmCategoryResult = (category: CategoryId, llm: LlmCategory, metrics?: Record<string, unknown>): CategoryResult => ({
  category,
  score: clampScore(llm.score),
  status: "COMPLETE",
  summary: llm.summary,
  ...findingsToIssuesAndFixes(category, llm.findings),
  toolsUsed: [...CATEGORIES[category].tools],
  metrics,
});
