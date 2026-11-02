"use client";

import { CreateAuditSchema } from "@sitescope/shared";
import { LoaderCircle, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createAudit } from "@/lib/api";

const CONTEXT_MAX = 4000;
const CONTEXT_PROMPTS = ["What the site is", "Who it's for", "What visitors should do", "Region / language"];

type FieldErrors = Partial<Record<"url" | "context", string[]>>;

export function NewAuditForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [contextLength, setContextLength] = useState(0);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = CreateAuditSchema.safeParse(raw);
    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors);
      return;
    }
    setFieldErrors({});
    setFormError(null);

    startTransition(async () => {
      const result = await createAudit(parsed.data);
      if (result.ok) {
        router.push(`/audits/${result.data.auditId}`);
        return;
      }
      setFieldErrors((result.error.fieldErrors as FieldErrors | undefined) ?? {});
      setFormError(result.error.fieldErrors?.url ? null : result.error.error);
    });
  };

  const urlError = fieldErrors.url?.[0];
  const contextError = fieldErrors.context?.[0];

  return (
    <form onSubmit={onSubmit} noValidate className="glass flex flex-col gap-6 rounded-2xl p-5 sm:p-7">
      <div className="flex flex-col gap-2">
        <Label htmlFor="url">Website URL</Label>
        <Input
          id="url"
          name="url"
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder="https://example.com"
          required
          aria-invalid={Boolean(urlError)}
          aria-describedby={urlError ? "url-error" : "url-hint"}
          className="h-11 text-base"
        />
        {urlError ? (
          <p id="url-error" className="text-sm text-destructive">
            {urlError}
          </p>
        ) : (
          <p id="url-hint" className="text-sm text-muted-foreground">
            Any public page. We&apos;ll also crawl a few key pages linked from it.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="context">About the site</Label>
          <span className="text-xs text-muted-foreground tabular-nums" aria-hidden>
            {contextLength}/{CONTEXT_MAX}
          </span>
        </div>
        <ul className="flex flex-wrap gap-1.5" aria-label="Helpful things to mention">
          {CONTEXT_PROMPTS.map((prompt) => (
            <li key={prompt} className="rounded-full border bg-background/60 px-2.5 py-0.5 text-xs text-muted-foreground">
              {prompt}
            </li>
          ))}
        </ul>
        <Textarea
          id="context"
          name="context"
          rows={6}
          maxLength={CONTEXT_MAX}
          required
          placeholder="e.g. A family-run bakery in Pune. Most visitors are locals on mobile looking for our menu and opening hours. We want more online pre-orders."
          onChange={(e) => setContextLength(e.target.value.length)}
          aria-invalid={Boolean(contextError)}
          aria-describedby={contextError ? "context-error" : "context-hint"}
        />
        {contextError ? (
          <p id="context-error" className="text-sm text-destructive">
            {contextError}
          </p>
        ) : (
          <p id="context-hint" className="text-sm text-muted-foreground">
            Claude uses this to judge content, GEO/AEO and which features you&apos;re missing.
          </p>
        )}
      </div>

      {formError && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Sparkles aria-hidden />}
        {pending ? "Starting the agent…" : "Start audit"}
      </Button>
    </form>
  );
}
