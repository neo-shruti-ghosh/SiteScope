import { z } from "zod";
import { CATEGORY_IDS } from "../config/categories";

export const Priority = z.enum(["high", "medium", "low"]);
export const Effort = z.enum(["S", "M", "L"]);
export const CategoryIdSchema = z.enum(CATEGORY_IDS);
export const CategoryStatus = z.enum(["COMPLETE", "PARTIAL", "FAILED"]);

export const IssueSchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string(),
  severity: Priority,
  evidence: z.string().optional(),
});

export const FixSchema = z.object({
  issueId: z.string().optional(),
  title: z.string(),
  steps: z.string(),
  priority: Priority,
  effort: Effort,
  effortHint: z.string().optional(),
  /** Reference documentation for the fix, e.g. the axe-core rule page. */
  learnMoreUrl: z.string().optional(),
});

export const CategoryResultSchema = z.object({
  category: CategoryIdSchema,
  score: z.number().int().min(0).max(100).nullable(),
  status: CategoryStatus,
  summary: z.string(),
  issues: z.array(IssueSchema),
  fixes: z.array(FixSchema),
  toolsUsed: z.array(z.string()),
  metrics: z.record(z.string(), z.unknown()).optional(),
});

export const UiIdeaSchema = z.object({
  title: z.string(),
  description: z.string(),
  impact: Priority,
  effort: Effort,
});

export type Issue = z.infer<typeof IssueSchema>;
export type Fix = z.infer<typeof FixSchema>;
export type CategoryResult = z.infer<typeof CategoryResultSchema>;
export type UiIdea = z.infer<typeof UiIdeaSchema>;
