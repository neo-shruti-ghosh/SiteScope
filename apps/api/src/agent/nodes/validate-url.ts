import { assertPublicUrl } from "../../security/ssrf";
import type { NodeOutcome } from "../safe-node";
import { fetchSafe } from "../tools/fetch-safe";
import type { AgentContext } from "../types";

/** Re-checks the URL (DNS can change after submission) and confirms the site responds. */
export const validateUrl = (ctx: AgentContext) => async (): Promise<NodeOutcome> => {
  await assertPublicUrl(ctx.url);
  await ctx.emit({ type: "tool_called", node: "validateUrl", message: `Checking that ${ctx.url} responds`, data: { tool: "crawler" } });

  const res = await fetchSafe(ctx.url, { maxBytes: 64_000, timeoutMs: 20_000 }).catch((error: unknown) => {
    throw new Error(`The site didn't respond: ${error instanceof Error ? error.message : String(error)}`);
  });
  if (res.status >= 500) throw new Error(`The site returned HTTP ${res.status}`);
  if (res.status >= 400) {
    await ctx.emit({
      type: "finding",
      node: "validateUrl",
      message: `The page returned HTTP ${res.status}; results may be limited`,
      data: { severity: "high" },
    });
  }

  const redirected = res.url !== ctx.url;
  return { update: {}, summary: redirected ? `Site responds (redirects to ${res.url})` : "Site is public and responding" };
};
