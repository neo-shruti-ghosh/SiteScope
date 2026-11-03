import type { CategoryResult } from "@sitescope/shared";
import { responsivenessResult, type ViewportCheck, VisualReviewSchema, withVisualReview } from "../categories/responsiveness";
import { SCREENSHOT_WIDTHS } from "../config";
import { VISION_REVIEW_SYSTEM, visionReviewPrompt } from "../llm/prompts";
import { askModel, imageBlock, llmEnabled, llmName, llmToolId } from "../tools/llm";
import type { NodeOutcome } from "../safe-node";
import type { AuditStateType } from "../state";
import type { AgentContext, Screenshot } from "../types";
import { saveScreenshot, screenshotPath } from "../../storage";
import { plural, saveResults } from "./shared";

/** Runs inside the page: measures overflow, tap-target size and tiny text at the current viewport. */
const inspectLayout = () => {
  const vw = document.documentElement.clientWidth;
  const describe = (el: Element) => {
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}` : "";
    return `${el.tagName.toLowerCase()}${id}${cls}`;
  };
  const isVisible = (el: Element) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
  };

  const wide = [...document.querySelectorAll("body *")].filter((el) => el.getBoundingClientRect().right > vw + 1 && isVisible(el));
  // Report the outermost offenders only.
  const overflowingElements = wide.filter((el) => !wide.some((other) => other !== el && other.contains(el))).slice(0, 5).map(describe);

  const targets = [...document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, [role=button]")]
    .filter(isVisible)
    // Links inside running text are exempt from WCAG 2.5.8.
    .filter((el) => !(el.tagName === "A" && el.closest("p, li")));
  const small = targets.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width < 24 || r.height < 24;
  });

  const smallText = [...document.querySelectorAll("p, span, a, li, td, label")].filter(
    (el) => isVisible(el) && (el.textContent ?? "").trim().length > 20 && parseFloat(getComputedStyle(el).fontSize) < 12,
  );

  return {
    overflowPx: Math.max(0, document.documentElement.scrollWidth - vw),
    overflowingElements,
    smallTapTargets: small.length,
    smallTapExamples: small.slice(0, 5).map(describe),
    smallTextCount: smallText.length,
  };
};

const viewportHeight = (width: number) => (width < 768 ? 812 : width < 1024 ? 1024 : 900);

/** The AI model looks at the screenshots for problems measurements can't see; falls back to measurements alone. */
const reviewVisually = async (
  ctx: AgentContext,
  measured: CategoryResult,
  captures: { check: ViewportCheck; shot: Screenshot }[],
): Promise<CategoryResult> => {
  if (!llmEnabled() || captures.length === 0) return measured;

  await ctx.emit({ type: "tool_called", node: "responsiveness", message: `${llmName} is reviewing the screenshots`, data: { tool: llmToolId } });
  try {
    const measurements = measured.issues.map((i) => `- ${i.title}`).join("\n") || "- No measured problems.";
    const images = await Promise.all(
      captures.map(async ({ shot }) => [{ type: "text" as const, text: `Screenshot at ${shot.width}px:` }, await imageBlock(shot.path)]),
    );
    const review = await askModel(VisualReviewSchema, "visual_review", VISION_REVIEW_SYSTEM, [
      { type: "text", text: visionReviewPrompt(ctx.userContext, measurements) },
      ...images.flat(),
    ], { onFallback: (message) => ctx.emit({ type: "finding", node: "responsiveness", message, data: { severity: "info" } }) });
    await Promise.all(
      review.findings
        .filter((f) => f.severity !== "low")
        .slice(0, 2)
        .map((f) => ctx.emit({ type: "finding", node: "responsiveness", message: `Visual review: ${f.title}`, data: { severity: f.severity } })),
    );
    return withVisualReview(measured, review);
  } catch (error) {
    await ctx.emit({
      type: "error",
      node: "responsiveness",
      message: `${llmName}'s visual review failed; using measurements only: ${error instanceof Error ? error.message : String(error)}`,
      data: { recoverable: true },
    });
    return measured;
  }
};

export const responsivenessNode = (ctx: AgentContext) => async (state: AuditStateType): Promise<NodeOutcome> => {
  const url = state.crawledPages[0]?.url ?? ctx.url;

  const capture = async (width: number): Promise<{ check: ViewportCheck; shot: Screenshot } | null> => {
    await ctx.emit({ type: "tool_called", node: "responsiveness", message: `Rendering at ${width}px`, data: { tool: "playwright" } });
    try {
      return await ctx.browser.withPage(
        url,
        { viewport: { width, height: viewportHeight(width) }, isMobile: width < 768, hasTouch: width < 1024 },
        async (page) => {
          const check = { width, ...(await page.evaluate(inspectLayout)) };
          const name = `w${width}.jpg`;
          const image = await page.screenshot({ type: "jpeg", quality: 70 });
          const shot = { width, url: await saveScreenshot(ctx.auditId, name, image), path: screenshotPath(ctx.auditId, name) };
          await ctx.emit({ type: "screenshot", node: "responsiveness", message: `Captured ${width}px screenshot`, data: { width, url: shot.url } });
          if (check.overflowPx > 1) {
            await ctx.emit({ type: "finding", node: "responsiveness", message: `Horizontal overflow at ${width}px (${check.overflowPx}px too wide)`, data: { severity: width < 768 ? "high" : "medium" } });
          }
          return { check, shot };
        },
      );
    } catch (error) {
      await ctx.emit({ type: "error", node: "responsiveness", message: `Couldn't render at ${width}px: ${String(error)}`, data: { recoverable: true } });
      return null;
    }
  };

  // Sequential so screenshots arrive in order and memory stays modest.
  const captures = await SCREENSHOT_WIDTHS.reduce<Promise<{ check: ViewportCheck; shot: Screenshot }[]>>(
    async (acc, width) => {
      const done = await acc;
      const result = await capture(width);
      return result ? [...done, result] : done;
    },
    Promise.resolve([]),
  );

  const mobile = captures.find((c) => c.check.width < 768)?.check;
  if (mobile?.smallTapTargets) {
    await ctx.emit({ type: "finding", node: "responsiveness", message: `${plural(mobile.smallTapTargets, "tap target")} under 24px on mobile`, data: { severity: "low" } });
  }

  const measured = responsivenessResult({
    viewportMeta: state.crawledPages[0]?.viewportMeta ?? null,
    checks: captures.map((c) => c.check),
  });
  const result = await reviewVisually(ctx, measured, captures);
  const update = await saveResults(ctx, [result]);
  return { update: { ...update, screenshots: captures.map((c) => c.shot) }, summary: "Responsiveness checks done" };
};
