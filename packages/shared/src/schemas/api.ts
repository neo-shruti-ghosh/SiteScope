import { z } from "zod";
import { CategoryResultSchema, UiIdeaSchema } from "./category";

export const AuditStatus = z.enum(["QUEUED", "RUNNING", "COMPLETED", "FAILED"]);

export const CreateAuditSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "Enter a URL")
    // Add a scheme only when none was typed, so "ftp://x" is rejected rather than becoming "https://ftp://x".
    .transform((v) => (/^[a-z][a-z\d+.-]*:\/\//i.test(v) ? v : `https://${v}`))
    .pipe(z.url({ protocol: /^https?$/, message: "Enter a valid http(s) URL" })),
  context: z.string().trim().min(10, "Tell us a little about the site (10+ characters)").max(4000),
});

export const ScreenshotSchema = z.object({ width: z.number(), url: z.string() });

export const AuditSummarySchema = z.object({
  id: z.string(),
  url: z.string(),
  status: AuditStatus,
  overallScore: z.number().nullable(),
  grade: z.string().nullable(),
  createdAt: z.string(),
});

export const AuditDetailSchema = AuditSummarySchema.extend({
  context: z.string(),
  error: z.string().nullable(),
  completedAt: z.string().nullable(),
  categoryResults: z.array(CategoryResultSchema),
  uiIdeas: z.array(UiIdeaSchema),
  screenshots: z.array(ScreenshotSchema),
});

export type CreateAuditInput = z.input<typeof CreateAuditSchema>;
export type AuditStatusValue = z.infer<typeof AuditStatus>;
export type AuditSummary = z.infer<typeof AuditSummarySchema>;
export type AuditDetail = z.infer<typeof AuditDetailSchema>;
