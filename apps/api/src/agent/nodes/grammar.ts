import { z } from "zod";
import { grammarResult } from "../categories/grammar";
import { GRAMMAR_FILTER_SYSTEM, grammarFilterPrompt } from "../llm/prompts";
import type { NodeOutcome } from "../safe-node";
import type { AuditStateType } from "../state";
import { askModel, llmEnabled, llmName, llmToolId } from "../tools/llm";
import { checkText, LANGUAGETOOL_MAX_CHARS, type LanguageToolMatch, languageToolCode } from "../tools/language-tool";
import type { AgentContext, CrawledPage } from "../types";
import { plural, saveResults } from "./shared";

const MIN_WORDS_PER_LINE = 4;
const MAX_FLAGS_FOR_REVIEW = 80;

/**
 * Visible text worth proofreading: drops short lines (menus, buttons) and lines repeated
 * across pages (headers, footers), then trims to what LanguageTool accepts in one request.
 */
export const proseFromPages = (pages: CrawledPage[]) => {
  const lines = pages
    .flatMap((p) => p.text.split("\n"))
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.split(" ").length >= MIN_WORDS_PER_LINE);
  const unique = [...new Set(lines)];
  const text = unique.reduce((acc, line) => (acc.length + line.length + 2 > LANGUAGETOOL_MAX_CHARS ? acc : `${acc}${line}\n\n`), "");
  return { text, wordCount: text.split(/\s+/).filter(Boolean).length };
};

const GrammarFilterSchema = z.object({
  genuine: z.array(z.number()).describe("Indices of flags that are real errors worth fixing"),
});

const describeFlag = (m: LanguageToolMatch, i: number) => {
  const { text, offset, length } = m.context;
  const marked = `${text.slice(0, offset)}「${text.slice(offset, offset + length)}」${text.slice(offset + length)}`;
  const suggestion = m.replacements[0]?.value;
  return `[${i}] ${m.message}${suggestion ? ` → "${suggestion}"` : ""}\n    ${marked}`;
};

/** Asks the AI model which LanguageTool flags are real errors (names, jargon and UI text are not). */
const filterWithModel = async (ctx: AgentContext, matches: LanguageToolMatch[], language: string) => {
  const reviewed = matches.slice(0, MAX_FLAGS_FOR_REVIEW);
  const { genuine } = await askModel(
    GrammarFilterSchema,
    "grammar_filter",
    GRAMMAR_FILTER_SYSTEM,
    grammarFilterPrompt(language, ctx.userContext, reviewed.map(describeFlag).join("\n")),
    { onFallback: (message) => ctx.emit({ type: "finding", node: "grammar", message, data: { severity: "info" } }) },
  );
  const keep = new Set(genuine);
  return reviewed.filter((_, i) => keep.has(i));
};

/** Matches confirmed by the AI model, or null when they couldn't be vetted (no key, or the call failed). */
const vetMatches = async (ctx: AgentContext, matches: LanguageToolMatch[], language: string) => {
  if (matches.length === 0) return [];
  if (!llmEnabled()) return null;

  await ctx.emit({ type: "tool_called", node: "grammar", message: `${llmName} is filtering out false positives`, data: { tool: llmToolId } });
  try {
    const kept = await filterWithModel(ctx, matches, language);
    await ctx.emit({
      type: "finding",
      node: "grammar",
      message: `${llmName} confirmed ${kept.length} of ${matches.length} flags as genuine errors`,
      data: { severity: kept.length > 5 ? "medium" : "info" },
    });
    return kept;
  } catch (error) {
    await ctx.emit({
      type: "error",
      node: "grammar",
      message: `${llmName} filtering failed, showing unfiltered results: ${error instanceof Error ? error.message : String(error)}`,
      data: { recoverable: true },
    });
    return null;
  }
};

export const grammarNode = (ctx: AgentContext) => async (state: AuditStateType): Promise<NodeOutcome> => {
  const { text, wordCount } = proseFromPages(state.crawledPages);
  if (wordCount === 0) throw new Error("No readable text was found on the crawled pages");

  await ctx.emit({
    type: "tool_called",
    node: "grammar",
    message: `Checking ${wordCount.toLocaleString("en")} words with LanguageTool`,
    data: { tool: "languageTool" },
  });
  const { matches, language } = await checkText(text, languageToolCode(state.crawledPages[0]?.lang ?? null));
  await ctx.emit({
    type: "finding",
    node: "grammar",
    message: matches.length ? `LanguageTool flagged ${plural(matches.length, "possible issue")}` : "No spelling or grammar issues flagged",
    data: { severity: "info" },
  });

  const vetted = await vetMatches(ctx, matches, language);
  const result = grammarResult(vetted ?? matches, wordCount, language, { filtered: vetted !== null });
  return { update: await saveResults(ctx, [result]), summary: "Grammar check done" };
};
