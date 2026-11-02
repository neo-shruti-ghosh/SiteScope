"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { googleSignInAction, loginAction, signupAction } from "@/lib/auth-actions";
import type { FormState } from "@/lib/auth-schemas";

interface Field {
  name: string;
  label: string;
  type: string;
  autoComplete: string;
}

const FIELDS: Record<"login" | "signup", Field[]> = {
  login: [
    { name: "email", label: "Email", type: "email", autoComplete: "email" },
    { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
  ],
  signup: [
    { name: "name", label: "Name", type: "text", autoComplete: "name" },
    { name: "email", label: "Email", type: "email", autoComplete: "email" },
    { name: "password", label: "Password", type: "password", autoComplete: "new-password" },
  ],
};

const COPY = {
  login: {
    title: "Welcome back",
    description: "Log in to run and review your site audits.",
    submit: "Log in",
    pending: "Logging in…",
    switchText: "New to SiteScope?",
    switchLink: { href: "/signup", label: "Create an account" },
  },
  signup: {
    title: "Create your account",
    description: "Start auditing your site in under a minute.",
    submit: "Sign up",
    pending: "Creating account…",
    switchText: "Already have an account?",
    switchLink: { href: "/login", label: "Log in" },
  },
} as const;

export function AuthForm({ mode, googleEnabled }: { mode: "login" | "signup"; googleEnabled: boolean }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    mode === "login" ? loginAction : signupAction,
    {},
  );
  const copy = COPY[mode];

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          <h1 className="text-lg">{copy.title}</h1>
        </CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form action={formAction} className="flex flex-col gap-4" noValidate>
          {FIELDS[mode].map((field) => {
            const error = state.fieldErrors?.[field.name]?.[0];
            const errorId = `${field.name}-error`;
            return (
              <div key={field.name} className="flex flex-col gap-2">
                <Label htmlFor={field.name}>{field.label}</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type={field.type}
                  autoComplete={field.autoComplete}
                  required
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? errorId : undefined}
                />
                {error && (
                  <p id={errorId} className="text-sm text-destructive">
                    {error}
                  </p>
                )}
              </div>
            );
          })}
          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? copy.pending : copy.submit}
          </Button>
        </form>
        {googleEnabled && (
          <form action={googleSignInAction}>
            <Button type="submit" variant="outline" className="w-full">
              Continue with Google
            </Button>
          </form>
        )}
      </CardContent>
      <CardFooter className="text-sm text-muted-foreground">
        {copy.switchText}&nbsp;
        <Link href={copy.switchLink.href} className="font-medium text-primary underline-offset-4 hover:underline">
          {copy.switchLink.label}
        </Link>
      </CardFooter>
    </Card>
  );
}
