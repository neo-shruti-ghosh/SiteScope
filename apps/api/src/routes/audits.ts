import { prisma } from "@sitescope/db";
import {
  type AuditDetail,
  type AuditSummary,
  CATEGORIES,
  CategoryResultSchema,
  CreateAuditSchema,
  ScreenshotSchema,
  UiIdeaSchema,
} from "@sitescope/shared";
import { Router } from "express";
import { z } from "zod";
import { enqueueAudit } from "../jobs/queue";
import { userIdOf } from "../middleware/auth";
import { auditRateLimit } from "../middleware/rateLimit";
import { assertPublicUrl, UnsafeUrlError } from "../security/ssrf";

export const auditsRouter = Router();

type AuditRow = Awaited<ReturnType<typeof prisma.audit.findFirstOrThrow>>;

const toSummary = (a: AuditRow): AuditSummary => ({
  id: a.id,
  url: a.url,
  status: a.status,
  overallScore: a.overallScore,
  grade: a.grade,
  createdAt: a.createdAt.toISOString(),
});

const findOwnedAudit = (id: string, userId: string) => prisma.audit.findFirst({ where: { id, userId } });

const createAudit = async (userId: string, url: string, context: string, rerunOfId?: string) => {
  const normalizedUrl = await assertPublicUrl(url);
  const audit = await prisma.audit.create({ data: { userId, url, normalizedUrl, context, rerunOfId } });
  enqueueAudit(audit.id);
  return audit;
};

auditsRouter.post("/", auditRateLimit, async (req, res) => {
  const parsed = CreateAuditSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", fieldErrors: z.flattenError(parsed.error).fieldErrors });
    return;
  }
  try {
    const audit = await createAudit(userIdOf(req), parsed.data.url, parsed.data.context);
    res.status(202).json({ auditId: audit.id });
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      res.status(400).json({ error: error.message, fieldErrors: { url: [error.message] } });
      return;
    }
    throw error;
  }
});

auditsRouter.get("/", async (req, res) => {
  const audits = await prisma.audit.findMany({
    where: { userId: userIdOf(req) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(audits.map(toSummary));
});

auditsRouter.get("/:id", async (req, res) => {
  const audit = await prisma.audit.findFirst({
    where: { id: req.params.id, userId: userIdOf(req) },
    include: { categoryResults: true },
  });
  if (!audit) {
    res.status(404).json({ error: "Audit not found" });
    return;
  }

  const categoryOrder = Object.keys(CATEGORIES);
  const detail: AuditDetail = {
    ...toSummary(audit),
    context: audit.context,
    error: audit.error,
    completedAt: audit.completedAt?.toISOString() ?? null,
    categoryResults: audit.categoryResults
      .map((r) =>
        CategoryResultSchema.parse({
          category: r.category,
          score: r.score,
          status: r.status,
          summary: r.summary,
          issues: r.issues,
          fixes: r.fixes,
          toolsUsed: r.toolsUsed,
          metrics: r.metrics ?? undefined,
        }),
      )
      .toSorted((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category)),
    uiIdeas: z.array(UiIdeaSchema).parse(audit.uiIdeas ?? []),
    screenshots: z.array(ScreenshotSchema).parse(audit.screenshots ?? []),
  };
  res.json(detail);
});

auditsRouter.post("/:id/rerun", auditRateLimit, async (req, res) => {
  const userId = userIdOf(req);
  const original = await findOwnedAudit(String(req.params.id), userId);
  if (!original) {
    res.status(404).json({ error: "Audit not found" });
    return;
  }
  try {
    const audit = await createAudit(userId, original.url, original.context, original.id);
    res.status(202).json({ auditId: audit.id });
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      res.status(400).json({ error: error.message });
      return;
    }
    throw error;
  }
});

export { findOwnedAudit };
