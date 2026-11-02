import { CATEGORIES, type CategoryResult, type Issue } from "@sitescope/shared";
import { scoreTextClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CategoryInfo } from "./category-info";
import { HowToFixDialog } from "./how-to-fix-dialog";
import { RadialGauge } from "./radial-gauge";

const PREVIEW_COUNT = 3;
const SEVERITY_RANK: Record<Issue["severity"], number> = { high: 0, medium: 1, low: 2 };
const SEVERITY_DOT: Record<Issue["severity"], string> = { high: "bg-poor", medium: "bg-average", low: "bg-muted-foreground/50" };

export function CategoryResultCard({ result }: { result: CategoryResult }) {
  const { label } = CATEGORIES[result.category];
  const issues = result.issues.toSorted((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  const preview = issues.slice(0, PREVIEW_COUNT);

  return (
    <article aria-labelledby={`cat-${result.category}`} className="flex flex-col gap-3 rounded-xl border bg-background/60 p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1">
          <h3 id={`cat-${result.category}`} className="font-medium leading-tight">
            {label}
          </h3>
          <CategoryInfo category={result.category} />
        </div>
        {result.status === "PARTIAL" && <span className="text-xs text-muted-foreground">partial</span>}
      </header>

      <div className="flex items-center gap-3">
        <RadialGauge score={result.score} size={56} strokeWidth={5}>
          <span className={cn("text-base font-semibold tabular-nums", scoreTextClass(result.score))}>
            {result.score ?? "–"}
          </span>
        </RadialGauge>
        <p className="line-clamp-3 text-sm text-muted-foreground">
          <span className="sr-only">Score {result.score === null ? "not available" : `${result.score} out of 100`}. </span>
          {result.summary}
        </p>
      </div>

      {preview.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            {issues.length} issue{issues.length === 1 ? "" : "s"} found
          </p>
          <ul className="flex flex-col gap-1.5">
            {preview.map((issue) => (
              <li key={issue.id} className="flex items-start gap-2 text-sm">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", SEVERITY_DOT[issue.severity])} aria-hidden />
                <span className="line-clamp-2">
                  <span className="sr-only">{issue.severity} severity: </span>
                  {issue.title}
                </span>
              </li>
            ))}
          </ul>
          {issues.length > PREVIEW_COUNT && (
            <p className="text-xs text-muted-foreground">+{issues.length - PREVIEW_COUNT} more in How to fix</p>
          )}
        </div>
      )}

      {/* Unscored categories (e.g. a tool failed) have nothing to fix yet; their summary explains why. */}
      {(result.score !== null || result.issues.length > 0) && (
        <div className="mt-auto pt-1">
          <HowToFixDialog result={result} />
        </div>
      )}
    </article>
  );
}
