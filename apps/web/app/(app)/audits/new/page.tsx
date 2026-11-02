import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { NewAuditForm } from "@/components/audit/new-audit-form";

export const metadata: Metadata = { title: "New audit" };

export default function NewAuditPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-aurora" />
      <Link
        href="/dashboard"
        className="flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Back to audits
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">New audit</h1>
        <p className="text-muted-foreground">
          The agent audits 10 categories and explains how to fix what it finds. It takes a few minutes.
        </p>
      </div>
      <NewAuditForm />
    </div>
  );
}
