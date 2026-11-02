import { z } from "zod";
import { CategoryResultSchema } from "./category";

export const NODE_IDS = [
  "validateUrl",
  "crawl",
  "lighthouse",
  "accessibility",
  "responsiveness",
  "seo",
  "grammar",
  "llmAnalysis",
  "scoreAggregator",
  "reportWriter",
] as const;
export const NodeIdSchema = z.enum(NODE_IDS);
export type NodeId = z.infer<typeof NodeIdSchema>;

const base = {
  seq: z.number().int().nonnegative(),
  auditId: z.string(),
  node: NodeIdSchema.optional(),
  message: z.string(),
  ts: z.string(),
};

export const AuditEventSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("node_started") }),
  z.object({ ...base, type: z.literal("node_completed") }),
  z.object({ ...base, type: z.literal("tool_called"), data: z.object({ tool: z.string() }) }),
  z.object({
    ...base,
    type: z.literal("finding"),
    data: z.object({ severity: z.enum(["high", "medium", "low", "info"]) }).optional(),
  }),
  z.object({ ...base, type: z.literal("error"), data: z.object({ recoverable: z.boolean() }).optional() }),
  z.object({ ...base, type: z.literal("category_result"), data: CategoryResultSchema }),
  z.object({ ...base, type: z.literal("screenshot"), data: z.object({ width: z.number(), url: z.string() }) }),
  z.object({
    ...base,
    type: z.literal("audit_completed"),
    data: z.object({ overallScore: z.number().nullable(), grade: z.string().nullable() }),
  }),
  z.object({ ...base, type: z.literal("audit_failed") }),
]);

export type AuditEvent = z.infer<typeof AuditEventSchema>;
export type AuditEventType = AuditEvent["type"];
export const TERMINAL_EVENTS: readonly AuditEventType[] = ["audit_completed", "audit_failed"];
