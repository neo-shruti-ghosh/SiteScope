import { prisma, type Prisma } from "@sitescope/db";
import { CATEGORIES, type CategoryResult } from "@sitescope/shared";
import type { Emit } from "../events/bus";

const json = (value: unknown) => value as Prisma.InputJsonValue;

/** Persists one category's result and announces it so the UI can flip that chip to a score. */
export const saveCategoryResult = async (auditId: string, result: CategoryResult, emit: Emit) => {
  const data = {
    score: result.score,
    status: result.status,
    summary: result.summary,
    issues: json(result.issues),
    fixes: json(result.fixes),
    toolsUsed: json(result.toolsUsed),
    metrics: result.metrics ? json(result.metrics) : undefined,
  };
  await prisma.categoryResult.upsert({
    where: { auditId_category: { auditId, category: result.category } },
    create: { auditId, category: result.category, ...data },
    update: data,
  });

  const label = CATEGORIES[result.category].label;
  await emit({
    type: "category_result",
    message: result.score === null ? `${label}: couldn't be scored` : `${label} scored ${result.score}/100`,
    data: result,
  });
};
