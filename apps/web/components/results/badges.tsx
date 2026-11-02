import type { Fix, Issue } from "@sitescope/shared";
import { cn } from "@/lib/utils";

const SEVERITY_STYLES: Record<Issue["severity"], string> = {
  high: "bg-poor/12 text-poor",
  medium: "bg-average/12 text-average",
  low: "bg-muted text-muted-foreground",
};

const SEVERITY_LABEL: Record<Issue["severity"], string> = { high: "High", medium: "Medium", low: "Low" };

export function SeverityBadge({ severity, suffix = "" }: { severity: Issue["severity"]; suffix?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-xs font-medium", SEVERITY_STYLES[severity])}>
      {SEVERITY_LABEL[severity]}
      {suffix}
    </span>
  );
}

const EFFORT_LABEL: Record<Fix["effort"], string> = { S: "Quick fix", M: "Moderate", L: "Major" };

export function EffortBadge({ effort, hint }: { effort: Fix["effort"]; hint?: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground">
      {EFFORT_LABEL[effort]}
      {hint && <span className="ml-1">· {hint}</span>}
    </span>
  );
}
