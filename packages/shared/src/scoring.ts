import { CATEGORIES, type CategoryId } from "./config/categories";

export type Grade = "A" | "B" | "C" | "D" | "F";

export interface ScoredCategory {
  category: CategoryId;
  score: number | null;
}

/** Weighted average over categories that produced a score; missing ones are dropped and weights re-normalised. */
export const overallScore = (results: readonly ScoredCategory[]): number | null => {
  const scored = results.filter((r): r is { category: CategoryId; score: number } => r.score !== null);
  const totalWeight = scored.reduce((sum, r) => sum + CATEGORIES[r.category].weight, 0);
  if (totalWeight === 0) return null;
  const weighted = scored.reduce((sum, r) => sum + r.score * CATEGORIES[r.category].weight, 0);
  return Math.round(weighted / totalWeight);
};

const GRADE_THRESHOLDS: readonly (readonly [number, Grade])[] = [
  [90, "A"],
  [80, "B"],
  [70, "C"],
  [60, "D"],
];

export const toGrade = (score: number): Grade => GRADE_THRESHOLDS.find(([min]) => score >= min)?.[1] ?? "F";

export type ScoreBand = "good" | "average" | "poor";

/** Lighthouse-style colour bands: green ≥ 90, amber ≥ 50, red below. */
export const scoreBand = (score: number): ScoreBand => (score >= 90 ? "good" : score >= 50 ? "average" : "poor");
