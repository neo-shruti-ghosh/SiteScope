import { z } from "zod";
import { env } from "../../env";

// The public API allows ~20 KB per request; leave headroom for multi-byte characters.
export const LANGUAGETOOL_MAX_CHARS = 15_000;

const MatchSchema = z.object({
  message: z.string(),
  shortMessage: z.string().optional(),
  offset: z.number(),
  length: z.number(),
  replacements: z.array(z.object({ value: z.string() })),
  context: z.object({ text: z.string(), offset: z.number(), length: z.number() }),
  rule: z.object({
    id: z.string(),
    description: z.string(),
    issueType: z.string().optional(),
    category: z.object({ id: z.string(), name: z.string() }),
  }),
});
const ResponseSchema = z.object({
  language: z.object({ name: z.string(), detectedLanguage: z.object({ name: z.string() }).optional() }),
  matches: z.array(MatchSchema),
});

export type LanguageToolMatch = z.infer<typeof MatchSchema>;

// Whitespace, typography and style suggestions are noise for a credibility check.
const IGNORED_ISSUE_TYPES = new Set(["whitespace", "typographical", "style", "locale-violation"]);
const IGNORED_CATEGORIES = new Set(["TYPOGRAPHY", "STYLE", "REDUNDANCY", "CASING"]);

// Primary language subtags LanguageTool supports; spelling needs a regional variant for some.
const SUPPORTED = new Set(["ar", "ast", "be", "br", "ca", "da", "de", "el", "en", "eo", "es", "fa", "fr", "ga", "gl", "it", "ja", "km", "nl", "pl", "pt", "ro", "ru", "sk", "sl", "sv", "ta", "tl", "uk", "zh"]);
const DEFAULT_VARIANT: Record<string, string> = { en: "en-US", de: "de-DE", pt: "pt-PT", ca: "ca-ES", nl: "nl-NL" };

/**
 * Maps a page's <html lang> to a LanguageTool code. Auto-detection misfires on short or
 * multilingual pages, so the declared language wins whenever it's supported.
 */
export const languageToolCode = (htmlLang: string | null): string => {
  const [primary = "", region] = (htmlLang ?? "").toLowerCase().split(/[-_]/);
  if (!SUPPORTED.has(primary)) return "auto";
  return region ? `${primary}-${region.toUpperCase()}` : (DEFAULT_VARIANT[primary] ?? primary);
};

export const checkText = async (text: string, language = "auto") => {
  const res = await fetch(env.LANGUAGETOOL_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ text: text.slice(0, LANGUAGETOOL_MAX_CHARS), language }),
    signal: AbortSignal.timeout(45_000),
  });
  if (res.status === 429) throw new Error("LanguageTool rate limit reached; try again in a minute");
  if (!res.ok) throw new Error(`LanguageTool responded ${res.status}`);

  const data = ResponseSchema.parse(await res.json());
  return {
    language: data.language.detectedLanguage?.name ?? data.language.name,
    matches: data.matches.filter(
      (m) => !IGNORED_ISSUE_TYPES.has(m.rule.issueType ?? "") && !IGNORED_CATEGORIES.has(m.rule.category.id),
    ),
  };
};
