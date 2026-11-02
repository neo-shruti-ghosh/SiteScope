"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { rerunAudit } from "@/lib/api";

export function RerunButton({ auditId, variant = "outline" }: { auditId: string; variant?: "outline" | "default" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const rerun = () =>
    startTransition(async () => {
      setError(null);
      const result = await rerunAudit(auditId);
      if (result.ok) router.push(`/audits/${result.data.auditId}`);
      else setError(result.error.error);
    });

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant={variant} onClick={rerun} disabled={pending}>
        <RotateCcw className={pending ? "animate-spin motion-reduce:animate-none" : undefined} aria-hidden />
        {pending ? "Starting…" : "Re-run audit"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
