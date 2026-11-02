import { prisma } from "@sitescope/db";
import type { RequestHandler } from "express";
import { env } from "../env";
import { userIdOf } from "./auth";

const WINDOW_MS = 60 * 60 * 1000;

/** Caps audits per user per rolling hour, counted from the Audit table (no extra store needed). */
export const auditRateLimit: RequestHandler = async (req, res, next) => {
  const since = new Date(Date.now() - WINDOW_MS);
  const recent = await prisma.audit.findMany({
    where: { userId: userIdOf(req), createdAt: { gte: since } },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const oldest = recent[0];
  if (recent.length >= env.AUDIT_RATE_LIMIT_PER_HOUR && oldest) {
    const retryAfter = Math.ceil((oldest.createdAt.getTime() + WINDOW_MS - Date.now()) / 1000);
    res.set("Retry-After", String(retryAfter));
    res.status(429).json({
      error: `You can run ${env.AUDIT_RATE_LIMIT_PER_HOUR} audits per hour. Try again in ${Math.ceil(retryAfter / 60)} min.`,
      retryAfter,
    });
    return;
  }
  next();
};
