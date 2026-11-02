import type { AuditSummary } from "@sitescope/shared";
import { ChevronRight, Globe } from "lucide-react";
import Link from "next/link";
import { hostOf, scoreTextClass, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

export function AuditList({ audits }: { audits: AuditSummary[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {audits.map((audit) => (
        <li key={audit.id}>
          <Link
            href={`/audits/${audit.id}`}
            className="glass group flex items-center gap-4 rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-ring motion-reduce:hover:translate-y-0"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Globe className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{hostOf(audit.url)}</p>
              <p className="truncate text-sm text-muted-foreground">
                {audit.url} · <time dateTime={audit.createdAt}>{timeAgo(audit.createdAt)}</time>
              </p>
            </div>
            <StatusBadge status={audit.status} />
            {audit.status === "COMPLETED" && (
              <div className="flex items-baseline gap-1.5 text-right">
                <span className={cn("text-2xl font-semibold tabular-nums", scoreTextClass(audit.overallScore))}>
                  {audit.overallScore ?? "–"}
                </span>
                <span className="text-sm text-muted-foreground">
                  <span className="sr-only">grade </span>
                  {audit.grade}
                </span>
              </div>
            )}
            <ChevronRight
              className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
