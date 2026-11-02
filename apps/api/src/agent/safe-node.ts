import { CATEGORIES, NODES, type NodeId } from "@sitescope/shared";
import { NODE_TIMEOUTS_MS } from "./config";
import type { AuditStateType, AuditStateUpdate } from "./state";
import type { AgentContext } from "./types";

export class NodeTimeoutError extends Error {}

const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new NodeTimeoutError(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

export interface NodeOutcome {
  update: AuditStateUpdate;
  /** Shown in the activity feed when the node completes. */
  summary: string;
}

interface SafeNodeOptions {
  startMessage: string;
  /** Fatal nodes abort the audit on failure; others degrade gracefully. */
  fatal?: boolean;
}

/**
 * Wraps a node with progress events, a timeout and graceful failure: if a tool node throws,
 * its unsaved categories are recorded as FAILED and the graph carries on.
 */
export const safeNode =
  (id: NodeId, ctx: AgentContext, run: (state: AuditStateType) => Promise<NodeOutcome>, options: SafeNodeOptions) =>
  async (state: AuditStateType): Promise<AuditStateUpdate> => {
    await ctx.emit({ type: "node_started", node: id, message: options.startMessage });
    try {
      const { update, summary } = await withTimeout(run(state), NODE_TIMEOUTS_MS[id], NODES[id].label);
      await ctx.emit({ type: "node_completed", node: id, message: summary });
      return update;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.error(`[audit ${ctx.auditId}] node ${id} failed:`, error);
      if (options.fatal) throw error;

      await ctx.emit({ type: "error", node: id, message: `${NODES[id].label} failed: ${reason}`, data: { recoverable: false } });
      const missing = NODES[id].categories.filter((c) => !ctx.savedCategories.has(c));
      const failed = missing.map((category) => ({
        category,
        score: null,
        status: "FAILED" as const,
        summary: `We couldn't measure ${CATEGORIES[category].label.toLowerCase()} this time: ${reason}`,
        issues: [],
        fixes: [],
        toolsUsed: [...CATEGORIES[category].tools],
      }));
      await Promise.all(failed.map(ctx.saveResult));
      await ctx.emit({ type: "node_completed", node: id, message: `${NODES[id].label} finished with errors` });
      return { categoryResults: Object.fromEntries(failed.map((r) => [r.category, r])) };
    }
  };
