import { prisma, type Prisma } from "@sitescope/db";
import { CATEGORIES, type CategoryResult } from "@sitescope/shared";
import { llmToolId } from "../agent/tools/llm";
import type { Emit } from "../events/bus";

const json = (value: unknown) => value as Prisma.InputJsonValue;

/** Category config lists the generic "ai" tool; saved results name the model that actually ran. */
const withConcreteTools = (result: CategoryResult): CategoryResult => ({
  ...result,
  toolsUsed: [...new Set(result.toolsUsed.map((t) => (t === "ai" ? llmToolId : t)))],
});

/** Persists one category's result and announces it so the UI can flip that chip to a score. */
export const saveCategoryResult = async (auditId: string, raw: CategoryResult, emit: Emit) => {
  const result = withConcreteTools(raw);
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
