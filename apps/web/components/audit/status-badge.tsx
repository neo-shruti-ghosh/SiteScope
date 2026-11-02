import type { AuditSummary } from "@sitescope/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: AuditSummary["status"] }) {
  if (status === "COMPLETED") return null;
  if (status === "FAILED") return <Badge variant="destructive">Failed</Badge>;
  return (
    <Badge variant="secondary" className="gap-1.5">
      <span className={cn("size-1.5 rounded-full bg-primary", "animate-pulse motion-reduce:animate-none")} aria-hidden />
      {status === "QUEUED" ? "Queued" : "Running"}
    </Badge>
  );
}
