import { LoaderCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Pulse that stops for people who prefer reduced motion. */
function Block({ className }: { className?: string }) {
  return <Skeleton className={cn("motion-reduce:animate-none", className)} />;
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("glass flex flex-col gap-3 rounded-2xl p-4 sm:p-5", className)}>{children}</div>;
}

/** Shown instantly while an audit page loads, shaped like the audit screen so nothing jumps when it arrives. */
export default function AuditLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4">
      <span className="sr-only">Loading audit…</span>
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-aurora" />

      <Panel className="items-center gap-6 sm:flex-row sm:p-6">
        <Block className="size-28 shrink-0 rounded-2xl" />
        <div className="flex w-full flex-col gap-3">
          <Block className="h-3 w-32" />
          <Block className="h-8 w-56" />
          <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-hidden>
            <LoaderCircle className="size-4 animate-spin text-primary motion-reduce:animate-none" />
            Loading audit…
          </div>
        </div>
        <Block className="size-32 shrink-0 rounded-full" />
      </Panel>

      <Panel>
        <Block className="h-4 w-20" />
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          {Array.from({ length: 6 }, (_, i) => (
            <Block key={i} className="h-10 lg:flex-1" />
          ))}
        </div>
      </Panel>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel>
          <Block className="h-4 w-36" />
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex flex-col gap-3 rounded-xl border p-4">
                <Block className="h-4 w-28" />
                <div className="flex items-center gap-3">
                  <Block className="size-14 shrink-0 rounded-full" />
                  <div className="flex w-full flex-col gap-2">
                    <Block className="h-3 w-full" />
                    <Block className="h-3 w-3/4" />
                  </div>
                </div>
                <Block className="h-8 w-full" />
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <Block className="h-4 w-24" />
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Block className="size-7 shrink-0 rounded-lg" />
              <div className="flex w-full flex-col gap-1.5">
                <Block className="h-3 w-full" />
                <Block className="h-2.5 w-1/3" />
              </div>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}
