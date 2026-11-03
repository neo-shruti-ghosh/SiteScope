import { CATEGORIES, type CategoryResult, type Issue } from "@sitescope/shared";
import type { LanguageToolMatch } from "../tools/language-tool";
import { clampScore } from "./format";

const MAX_ISSUES = 15;
/** Points lost per error per 1,000 words. */
const PENALTY_PER_ERROR_PER_1K = 8;
/** Rates are computed over at least this many words so a few slips on a tiny page don't zero the score. */
const MIN_WORDS_FOR_RATE = 300;

const severityOf = (m: LanguageToolMatch): Issue["severity"] =>
  m.rule.issueType === "misspelling" ? "medium" : m.rule.category.id === "GRAMMAR" ? "high" : "low";

const snippet = (m: LanguageToolMatch) => {
  const { text, offset, length } = m.context;
  return `…${text.slice(0, offset)}「${text.slice(offset, offset + length)}」${text.slice(offset + length)}…`;
};

export const grammarResult = (
  matches: LanguageToolMatch[],
  wordCount: number,
  language: string,
  { filtered }: { filtered: boolean },
): CategoryResult => {
  // Unfiltered spelling hits are mostly names and jargon, so they only count once the AI model has vetted them.
  const counted = filtered ? matches : matches.filter((m) => m.rule.issueType !== "misspelling");
  const per1k = (counted.length / Math.max(wordCount, MIN_WORDS_FOR_RATE)) * 1000;
  const score = clampScore(100 - per1k * PENALTY_PER_ERROR_PER_1K);

  const flagged = (m: LanguageToolMatch) => m.context.text.slice(m.context.offset, m.context.offset + m.context.length);
  const issues: Issue[] = matches.slice(0, MAX_ISSUES).map((m, i) => ({
    id: `lt-${i}`,
    // Name the flagged text so a list of "Spelling mistake" entries is still informative.
    title: `${m.shortMessage || m.rule.description}: "${flagged(m)}"`,
    detail: m.message,
    severity: severityOf(m),
    evidence: snippet(m),
  }));

  return {
    category: "grammar",
    score,
    // Without AI false-positive filtering (names, brand terms), results are only indicative.
    status: filtered ? "COMPLETE" : "PARTIAL",
    summary:
      matches.length === 0
        ? `No spelling or grammar issues found in ${wordCount.toLocaleString("en")} words (${language}).`
        : `${matches.length} possible issue${matches.length === 1 ? "" : "s"} in ${wordCount.toLocaleString("en")} words (${language}).`,
    issues,
    fixes: issues.map((issue, i) => {
      const suggestion = matches[i]?.replacements[0]?.value;
      return {
        issueId: issue.id,
        title: suggestion ? `Change to "${suggestion}"` : `Review: ${issue.title}`,
        steps: suggestion ? `In the passage ${issue.evidence}, replace the marked text with "${suggestion}".` : issue.detail,
        priority: issue.severity,
        effort: "S",
        effortHint: "~2 min",
      };
    }),
    toolsUsed: filtered ? [...CATEGORIES.grammar.tools] : ["languageTool"],
    metrics: { wordCount, language, errorsPer1000Words: Number(per1k.toFixed(1)) },
  };
};
