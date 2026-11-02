import { prisma, type Prisma } from "@sitescope/db";
import { CategoryIdSchema, overallScore, toGrade } from "@sitescope/shared";
import PQueue from "p-queue";
import { runAuditGraph } from "../agent/graph";
import { env } from "../env";
import { createEmitter } from "../events/bus";
import { mockRun } from "../mock/mockRun";
import type { AuditRunner } from "./types";

const queue = new PQueue({ concurrency: 2 });

// Mock mode replays a scripted run: handy for UI work and end-to-end tests.
const runner: AuditRunner = env.AUDIT_MOCK_MODE ? mockRun : runAuditGraph;

const runAudit = async (auditId: string) => {
  const audit = await prisma.audit.update({
    where: { id: auditId },
    data: { status: "RUNNING", startedAt: new Date() },
  });
  const emit = await createEmitter(auditId);

  try {
    const { uiIdeas, screenshots } = await runner({ auditId, url: audit.normalizedUrl, context: audit.context, emit });

    const results = await prisma.categoryResult.findMany({ where: { auditId }, select: { category: true, score: true } });
    const score = overallScore(results.map((r) => ({ category: CategoryIdSchema.parse(r.category), score: r.score })));
    const grade = score === null ? null : toGrade(score);

    // Emit the terminal event before flipping the status: an SSE client that sees a finished
    // audit assumes it already has the terminal event (see routes/events.ts).
    await emit({
      type: "audit_completed",
      message: score === null ? "Audit finished" : `Audit complete: ${score}/100 (grade ${grade})`,
      data: { overallScore: score, grade },
    });
    await prisma.audit.update({
      where: { id: auditId },
      data: {
        status: "COMPLETED",
        overallScore: score,
        grade,
        uiIdeas: uiIdeas as unknown as Prisma.InputJsonValue,
        screenshots: screenshots as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[audit ${auditId}] failed:`, error);
    await emit({ type: "audit_failed", message: `Audit failed: ${message}` });
    await prisma.audit.update({ where: { id: auditId }, data: { status: "FAILED", error: message, completedAt: new Date() } });
  }
};

/** Starts the audit in the background; the HTTP request returns immediately. */
export const enqueueAudit = (auditId: string) => {
  void queue.add(() => runAudit(auditId));
};

/** Jobs live in memory, so anything mid-flight when the server stopped can't resume. */
export const failStaleAudits = async () => {
  const { count } = await prisma.audit.updateMany({
    where: { status: { in: ["QUEUED", "RUNNING"] } },
    data: { status: "FAILED", error: "The server restarted before this audit finished. Please re-run it.", completedAt: new Date() },
  });
  if (count > 0) console.warn(`Marked ${count} interrupted audit(s) as failed.`);
};
