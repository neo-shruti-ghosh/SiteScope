import { devicePerformanceResult, METRIC_THRESHOLDS, performanceResult, rateMetric, slowLoadingResult } from "../categories/performance";
import { formatBytes } from "../categories/format";
import type { NodeOutcome } from "../safe-node";
import { type FormFactor, getLighthouse, type LighthouseSummary, type MetricKey } from "../tools/lighthouse";
import type { AgentContext } from "../types";
import { saveResults } from "./shared";

const announce = async (ctx: AgentContext, s: LighthouseSummary) => {
  await ctx.emit({
    type: "finding",
    node: "lighthouse",
    message: `${s.formFactor === "mobile" ? "Mobile" : "Desktop"} performance score: ${s.scores.performance ?? "n/a"}`,
    data: { severity: (s.scores.performance ?? 0) >= 90 ? "info" : (s.scores.performance ?? 0) >= 50 ? "medium" : "high" },
  });
  const worst = (Object.keys(METRIC_THRESHOLDS) as MetricKey[]).find((k) => rateMetric(k, s.metrics[k].value) === "poor");
  if (worst) {
    await ctx.emit({
      type: "finding",
      node: "lighthouse",
      message: `${METRIC_THRESHOLDS[worst].label} is ${s.metrics[worst].display} on ${s.formFactor}`,
      data: { severity: "high" },
    });
  }
};

/** Runs Lighthouse for mobile then desktop; one failing profile still yields partial results. */
export const lighthouseNode = (ctx: AgentContext) => async (): Promise<NodeOutcome> => {
  // Enqueue both now so mobile and desktop run back to back in the shared Lighthouse queue.
  const runs = { mobile: getLighthouse(ctx.url, "mobile"), desktop: getLighthouse(ctx.url, "desktop") };
  runs.desktop.catch(() => undefined);

  const measure = async (formFactor: FormFactor) => {
    await ctx.emit({ type: "tool_called", node: "lighthouse", message: `Running Lighthouse on ${formFactor}…`, data: { tool: "lighthouse" } });
    try {
      const summary = await runs[formFactor];
      await announce(ctx, summary);
      return summary;
    } catch (error) {
      await ctx.emit({
        type: "error",
        node: "lighthouse",
        message: `Lighthouse ${formFactor} run failed: ${error instanceof Error ? error.message : String(error)}`,
        data: { recoverable: true },
      });
      return undefined;
    }
  };

  const mobile = await measure("mobile");
  const desktop = await measure("desktop");
  if (!mobile && !desktop) throw new Error("Lighthouse couldn't load the page on either device profile");

  const lighthouseReports = { ...(mobile && { mobile }), ...(desktop && { desktop }) };
  const biggest = (mobile ?? desktop)?.largestRequests[0];
  if (biggest?.bytes) {
    await ctx.emit({
      type: "finding",
      node: "lighthouse",
      message: `Largest resource: ${biggest.label.split("/").pop() || biggest.label} (${formatBytes(biggest.bytes)})`,
      data: { severity: biggest.bytes > 500_000 ? "medium" : "info" },
    });
  }

  const results = await saveResults(ctx, [
    performanceResult(lighthouseReports),
    devicePerformanceResult(lighthouseReports),
    slowLoadingResult(lighthouseReports),
  ]);
  return { update: { ...results, lighthouseReports }, summary: "Lighthouse finished" };
};
