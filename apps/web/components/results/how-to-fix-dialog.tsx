"use client";

import { CATEGORIES, type CategoryResult, type Fix, type Issue, TOOLS, type ToolId } from "@sitescope/shared";
import { ExternalLink, PartyPopper, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { scoreTextClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EffortBadge, SeverityBadge } from "./badges";
import { RadialGauge } from "./radial-gauge";

const SEVERITY_RANK: Record<Issue["severity"], number> = { high: 0, medium: 1, low: 2 };
const isToolId = (t: string): t is ToolId => t in TOOLS;

function FixBlock({ fix }: { fix: Fix }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Wrench className="size-3.5 text-primary" aria-hidden />
        <h4 className="font-medium wrap-anywhere">{fix.title}</h4>
        <SeverityBadge severity={fix.priority} suffix=" priority" />
        <EffortBadge effort={fix.effort} hint={fix.effortHint} />
      </div>
      <p className="leading-relaxed text-muted-foreground wrap-anywhere">{fix.steps}</p>
      {fix.learnMoreUrl && (
        <a
          href={fix.learnMoreUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 self-start text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Learn more <ExternalLink className="size-3.5" aria-hidden />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      )}
    </div>
  );
}

function IssueBlock({ issue, fixes }: { issue: Issue; fixes: Fix[] }) {
  return (
    <li className="flex flex-col gap-2.5 rounded-xl border p-4">
      <div className="flex items-start gap-2">
        <SeverityBadge severity={issue.severity} />
        <h3 className="font-medium leading-snug wrap-anywhere">{issue.title}</h3>
      </div>
      <p className="leading-relaxed wrap-anywhere">{issue.detail}</p>
      {issue.evidence && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Found on your site</p>
          <pre className="max-h-32 overflow-auto rounded-md bg-muted px-3 py-2 font-mono text-xs whitespace-pre-wrap break-all">
            {issue.evidence}
          </pre>
        </div>
      )}
      {fixes.map((fix) => (
        <FixBlock key={`${fix.issueId}-${fix.title}`} fix={fix} />
      ))}
    </li>
  );
}

/** "How to fix?" button and modal: each issue described, with the fix for it right underneath. */
export function HowToFixDialog({ result }: { result: CategoryResult }) {
  const { label, definition } = CATEGORIES[result.category];
  const issues = result.issues.toSorted((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  const fixesFor = (issue: Issue) => result.fixes.filter((f) => f.issueId === issue.id);
  // Fixes not tied to a listed issue (e.g. one fix shared by several findings) go at the end.
  const looseFixes = result.fixes.filter((f) => !f.issueId || !result.issues.some((i) => i.id === f.issueId));
  const tools = result.toolsUsed.map((t) => (isToolId(t) ? TOOLS[t].name : t));

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <Wrench aria-hidden /> How to fix?
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-2xl [&>*]:min-w-0">
        <DialogHeader>
          <div className="flex items-center gap-3 pr-8">
            <RadialGauge score={result.score} size={52} strokeWidth={5}>
              <span className={cn("text-sm font-semibold tabular-nums", scoreTextClass(result.score))}>
                {result.score ?? "–"}
              </span>
            </RadialGauge>
            <div className="min-w-0">
              <DialogTitle className="text-lg">How to improve {label}</DialogTitle>
              <DialogDescription>{result.summary}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">What this measures: </span>
          {definition}
        </p>

        {issues.length === 0 && looseFixes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <PartyPopper className="size-8 text-good" aria-hidden />
            <p className="font-medium">{result.score === null ? "Nothing to show" : "Nothing to fix here"}</p>
            <p className="max-w-sm text-muted-foreground">
              {result.score === null
                ? "This category couldn't be measured, so there are no suggestions yet. Re-running the audit may help."
                : "We didn't find any problems in this category."}
            </p>
          </div>
        ) : (
          <section aria-label="Issues and fixes" className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">
              What we found ({issues.length} issue{issues.length === 1 ? "" : "s"})
            </h3>
            <ol className="flex flex-col gap-3">
              {issues.map((issue) => (
                <IssueBlock key={issue.id} issue={issue} fixes={fixesFor(issue)} />
              ))}
            </ol>
            {looseFixes.length > 0 && (
              <>
                <h3 className="mt-2 text-sm font-semibold">More suggestions</h3>
                {looseFixes.map((fix) => (
                  <FixBlock key={fix.title} fix={fix} />
                ))}
              </>
            )}
          </section>
        )}

        <p className="border-t pt-3 text-xs text-muted-foreground">Measured with {tools.join(", ")}.</p>
      </DialogContent>
    </Dialog>
  );
}
