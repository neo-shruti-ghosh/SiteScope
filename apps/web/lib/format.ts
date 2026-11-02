import { type ScoreBand, scoreBand } from "@sitescope/shared";

const BAND_TEXT: Record<ScoreBand, string> = {
  good: "text-good",
  average: "text-average",
  poor: "text-poor",
};

const BAND_STROKE: Record<ScoreBand, string> = {
  good: "stroke-good",
  average: "stroke-average",
  poor: "stroke-poor",
};

export const scoreTextClass = (score: number | null) => (score === null ? "text-muted-foreground" : BAND_TEXT[scoreBand(score)]);
export const scoreStrokeClass = (score: number | null) => (score === null ? "stroke-muted" : BAND_STROKE[scoreBand(score)]);

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export const timeAgo = (iso: string, now = Date.now()) => {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const [unit, size] = UNITS.find(([, s]) => Math.abs(seconds) >= s) ?? ["second", 1];
  return unit === "second" ? "just now" : rtf.format(Math.round(seconds / size), unit);
};

export const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};
