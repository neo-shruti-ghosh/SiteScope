import type { CategoryResult } from "@sitescope/shared";
import type { AuditStateUpdate } from "../state";
import type { AgentContext } from "../types";

/** Saves results (persist + announce) and returns the matching state update. */
export const saveResults = async (ctx: AgentContext, results: CategoryResult[]): Promise<AuditStateUpdate> => {
  await Promise.all(results.map(ctx.saveResult));
  return { categoryResults: Object.fromEntries(results.map((r) => [r.category, r])) };
};

export const plural = (n: number, word: string, pluralWord = `${word}s`) => `${n} ${n === 1 ? word : pluralWord}`;
