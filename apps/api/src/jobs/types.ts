import type { UiIdea } from "@sitescope/shared";
import type { Emit } from "../events/bus";

export interface AuditJob {
  auditId: string;
  url: string;
  context: string;
  emit: Emit;
}

/** Runs the audit, saving category results as it goes. Throwing marks the whole audit FAILED. */
export type AuditRunner = (job: AuditJob) => Promise<{ uiIdeas: UiIdea[]; screenshots: { width: number; url: string }[] }>;
