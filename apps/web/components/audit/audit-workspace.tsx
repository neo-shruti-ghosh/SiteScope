"use client";

import { type AuditDetail, CATEGORY_IDS } from "@sitescope/shared";
import { ArrowRight } from "lucide-react";
import { MotionConfig, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { ActivityFeed } from "@/components/agent/activity-feed";
import { AgentBackground } from "@/components/agent/agent-background";
import { AgentIllustration } from "@/components/agent/agent-illustration";
import { CategoryChips } from "@/components/agent/category-chips";
import { Pipeline } from "@/components/agent/pipeline";
import { ScreenshotStrip } from "@/components/agent/screenshot-strip";
import { CategoryResultCard } from "@/components/results/category-result-card";
import { IdeasSection } from "@/components/results/ideas-section";
import { RadialGauge } from "@/components/results/radial-gauge";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuditStream } from "@/hooks/use-audit-stream";
import type { StreamState } from "@/lib/audit-stream";
import { hostOf, scoreTextClass, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RerunButton } from "./rerun-button";

const RESULTS_DELAY_MS = 2500;

function Panel({
  title,
  children,
  className,
  scrollable = false,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  scrollable?: boolean;
}) {
  return (
    // Scrollable regions need to be focusable so keyboard users can scroll them.
    <section aria-label={title} tabIndex={scrollable ? 0 : undefined} className={cn("glass rounded-2xl p-4 sm:p-5", className)}>
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function LiveHero({ audit, stream }: { audit: AuditDetail; stream: StreamState }) {
  const router = useRouter();
  const checked = CATEGORY_IDS.filter((id) => stream.chips[id].state === "done").length;
  const progress = stream.status === "completed" ? 100 : Math.round((checked / CATEGORY_IDS.length) * 95);
  const currentStep = stream.feed.find((e) => e.type !== "category_result")?.message;
  const headline = {
    connecting: "Connecting to the agent…",
    running: "Agent at work",
    completed: "Audit complete",
    failed: "The audit hit a problem",
  }[stream.status];

  return (
    <section className="glass flex flex-col items-center gap-6 rounded-2xl p-5 sm:flex-row sm:p-6">
      <AgentIllustration
        mood={stream.status === "completed" ? "done" : stream.status === "failed" ? "failed" : "working"}
        className="max-w-56 shrink-0"
      />
      <div className="flex w-full min-w-0 flex-col gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary">{hostOf(audit.url)}</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{headline}</h1>
        </div>
        <p aria-live="polite" className="min-h-5 truncate text-sm text-muted-foreground">
          {stream.status === "completed" && stream.overall
            ? `Overall score ${stream.overall.score ?? "–"}/100. Opening your results…`
            : stream.status === "failed"
              ? stream.failure
              : (currentStep ?? "Queued, starting shortly…")}
        </p>
        <div
          role="progressbar"
          aria-label="Categories checked"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="h-2 overflow-hidden rounded-full bg-muted"
        >
          <motion.div
            className={cn("h-full rounded-full", stream.status === "failed" ? "bg-poor" : "bg-primary")}
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.6 }}
          />
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          {checked} of {CATEGORY_IDS.length} categories checked
        </p>
        {stream.status === "completed" && (
          <div className="flex flex-wrap items-center gap-3">
            <span className={cn("text-4xl font-bold tabular-nums", scoreTextClass(stream.overall?.score ?? null))}>
              {stream.overall?.score ?? "–"}
              <span className="ml-2 text-lg font-medium text-muted-foreground">grade {stream.overall?.grade ?? "–"}</span>
            </span>
            <Button onClick={() => router.refresh()}>
              View results <ArrowRight aria-hidden />
            </Button>
          </div>
        )}
        {stream.status === "failed" && <RerunButton auditId={audit.id} variant="default" />}
      </div>
    </section>
  );
}

function ResultsHero({ audit }: { audit: AuditDetail }) {
  const scored = audit.categoryResults.filter((r) => r.score !== null).length;
  return (
    <section className="glass flex flex-col items-center gap-6 rounded-2xl p-5 sm:flex-row sm:p-6">
      <AgentIllustration mood="done" className="hidden max-w-48 shrink-0 md:block" />
      <div className="flex w-full min-w-0 flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">{hostOf(audit.url)}</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Audit results</h1>
        <p className="text-sm text-muted-foreground">
          {audit.completedAt && <>Completed {timeAgo(audit.completedAt)} · </>}
          {scored} of {CATEGORY_IDS.length} categories scored
        </p>
        <div className="mt-3">
          <RerunButton auditId={audit.id} />
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-center gap-1">
        <RadialGauge score={audit.overallScore} size={128} strokeWidth={10}>
          <div className="flex flex-col items-center">
            <span className={cn("text-4xl font-bold tabular-nums", scoreTextClass(audit.overallScore))}>
              {audit.overallScore ?? "–"}
            </span>
            <span className="text-xs text-muted-foreground">out of 100</span>
          </div>
        </RadialGauge>
        <p className="text-sm font-medium">
          Grade <span className={scoreTextClass(audit.overallScore)}>{audit.grade ?? "–"}</span>
        </p>
      </div>
    </section>
  );
}

/**
 * One screen for an audit's whole life: live progress while it runs, then the same pipeline,
 * screenshots and activity log (replayed from stored events) alongside the scored results.
 */
export function AuditWorkspace({ audit }: { audit: AuditDetail }) {
  const router = useRouter();
  const stream = useAuditStream(audit.id);
  const hasResults = audit.status === "COMPLETED";

  // When a run we were watching finishes, re-render on the server to load the saved results.
  // Skipped for audits that were already complete (their stream is just a replay).
  useEffect(() => {
    if (hasResults || stream.status !== "completed") return;
    const timer = setTimeout(() => router.refresh(), RESULTS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [hasResults, stream.status, router]);

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={150}>
        <AgentBackground />
        <div className="flex flex-col gap-4">
          {hasResults ? <ResultsHero audit={audit} /> : <LiveHero audit={audit} stream={stream} />}

          <Panel title="Pipeline">
            <Pipeline nodes={stream.nodes} />
          </Panel>

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="flex min-w-0 flex-col gap-4">
              <Panel title={hasResults ? "Scores by category" : "Categories"}>
                {hasResults ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {audit.categoryResults.map((result) => (
                      <CategoryResultCard key={result.category} result={result} />
                    ))}
                  </div>
                ) : (
                  <CategoryChips chips={stream.chips} />
                )}
              </Panel>
              <Panel title="Screenshots">
                <ScreenshotStrip screenshots={hasResults ? audit.screenshots : stream.screenshots} />
              </Panel>
            </div>

            <Panel
              title={hasResults ? "Activity log" : "Live activity"}
              scrollable
              className="max-h-[28rem] overflow-y-auto lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)]"
            >
              <ActivityFeed events={stream.feed} />
            </Panel>
          </div>

          {hasResults && audit.uiIdeas.length > 0 && (
            <Panel title="Ideas to improve UI/UX">
              <IdeasSection ideas={audit.uiIdeas} />
            </Panel>
          )}
        </div>
      </TooltipProvider>
    </MotionConfig>
  );
}
