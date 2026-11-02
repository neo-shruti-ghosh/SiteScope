import { Plus, ScanSearch } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuditList } from "@/components/audit/audit-list";
import { Button } from "@/components/ui/button";
import { fetchAudits } from "@/lib/server-api";

export const metadata: Metadata = { title: "Dashboard" };

function EmptyState() {
  return (
    <div className="glass flex flex-col items-center gap-4 rounded-2xl px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <ScanSearch className="size-7" aria-hidden />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">No audits yet</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Point the agent at any public website. It checks performance, accessibility, SEO and more, then tells you
          what to fix first.
        </p>
      </div>
      <Button asChild>
        <Link href="/audits/new">
          <Plus aria-hidden /> Run your first audit
        </Link>
      </Button>
    </div>
  );
}

export default async function DashboardPage() {
  const audits = await fetchAudits();

  return (
    <div className="flex flex-col gap-6">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-aurora" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Your audits</h1>
          <p className="text-muted-foreground">Re-open past reports or start a new audit.</p>
        </div>
        {audits.length > 0 && (
          <Button asChild>
            <Link href="/audits/new">
              <Plus aria-hidden /> New audit
            </Link>
          </Button>
        )}
      </div>
      {audits.length === 0 ? <EmptyState /> : <AuditList audits={audits} />}
    </div>
  );
}
