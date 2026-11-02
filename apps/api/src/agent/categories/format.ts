import type { Issue } from "@sitescope/shared";

export const formatBytes = (bytes: number) =>
  bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;

export const formatMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`);

export const clampScore = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export const severityFromScore = (score: number | null): Issue["severity"] =>
  score === null || score < 0.5 ? "high" : score < 0.9 ? "medium" : "low";

const SEVERITY_ORDER: Record<Issue["severity"], number> = { high: 0, medium: 1, low: 2 };
export const bySeverity = (a: { severity: Issue["severity"] }, b: { severity: Issue["severity"] }) =>
  SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];

/** First sentence of a description, which is usually the useful part. */
export const firstSentence = (text: string) => text.split(/(?<=\.)\s/)[0] ?? text;
