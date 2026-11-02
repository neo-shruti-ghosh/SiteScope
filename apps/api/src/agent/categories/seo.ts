import { CATEGORIES, type CategoryResult, type Effort, type Priority } from "@sitescope/shared";
import type { z } from "zod";
import type { CrawledPage, SiteFiles } from "../types";
import { bySeverity, clampScore } from "./format";

interface SeoCheck {
  id: string;
  passed: boolean;
  title: string;
  detail: string;
  severity: z.infer<typeof Priority>;
  fix: { title: string; steps: string; effort: z.infer<typeof Effort> };
  evidence?: string;
}

const between = (n: number, min: number, max: number) => n >= min && n <= max;

/** Crawl-based SEO checks. Pure: takes the crawled pages, returns pass/fail for each rule. */
export const seoChecks = (pages: CrawledPage[], files: SiteFiles): SeoCheck[] => {
  const home = pages[0];
  if (!home) return [];
  const h1s = home.headings.filter((h) => h.level === 1);
  const skipped = home.headings.find((h, i) => i > 0 && h.level - (home.headings[i - 1]?.level ?? h.level) > 1);
  const missingAlt = pages.flatMap((p) => p.images.filter((img) => img.alt === null).map((img) => img.src));
  const titles = pages.map((p) => p.title).filter(Boolean);
  const duplicateTitles = titles.filter((t, i) => titles.indexOf(t) !== i);
  const missingOg = ["og:title", "og:description", "og:image"].filter((k) => !home.og[k]);

  return [
    {
      id: "title",
      passed: between(home.title.length, 10, 60),
      title: home.title ? `Title is ${home.title.length} characters` : "Page has no <title>",
      detail: "Search results show roughly the first 60 characters of the title.",
      severity: home.title ? "medium" : "high",
      evidence: home.title || undefined,
      fix: { title: "Write a 30–60 character title", steps: "Lead with the primary keyword and brand, e.g. \"Fresh Sourdough in Pune | Bake House\".", effort: "S" },
    },
    {
      id: "meta-description",
      passed: home.metaDescription !== null && between(home.metaDescription.length, 50, 160),
      title: home.metaDescription ? `Meta description is ${home.metaDescription.length} characters` : "No meta description",
      detail: "A 50–160 character description is often used as the search snippet and improves click-through.",
      severity: home.metaDescription ? "low" : "medium",
      evidence: home.metaDescription ?? undefined,
      fix: { title: "Add a compelling meta description", steps: "Summarise the page's value in 120–155 characters with a call to action.", effort: "S" },
    },
    {
      id: "h1",
      passed: h1s.length === 1,
      title: h1s.length === 0 ? "No H1 heading" : `${h1s.length} H1 headings on the homepage`,
      detail: "One clear H1 tells search engines and screen readers what the page is about.",
      severity: h1s.length === 0 ? "high" : "low",
      evidence: h1s.map((h) => h.text).join("\n") || undefined,
      fix: { title: "Use exactly one descriptive H1", steps: "Make the main headline an <h1> and demote other large headings to <h2>.", effort: "S" },
    },
    {
      id: "heading-order",
      passed: !skipped,
      title: "Heading levels skip a level",
      detail: "Jumping (e.g. H2 → H4) breaks the document outline.",
      severity: "low",
      evidence: skipped?.text,
      fix: { title: "Fix heading hierarchy", steps: "Nest headings in order (H1 → H2 → H3) and style them with CSS instead of picking levels for size.", effort: "S" },
    },
    {
      id: "canonical",
      passed: home.canonical !== null,
      title: "No canonical URL",
      detail: "A canonical link prevents duplicate-content issues from URL variants (tracking parameters, trailing slashes).",
      severity: "medium",
      fix: { title: "Add a canonical link", steps: "Add <link rel=\"canonical\" href=\"https://your-site/page\"> to every page, pointing at its preferred URL.", effort: "S" },
    },
    {
      id: "lang",
      passed: home.lang !== null,
      title: "<html> has no lang attribute",
      detail: "The lang attribute helps search engines serve the right regional results and helps screen readers pronounce text.",
      severity: "low",
      fix: { title: "Declare the page language", steps: "Add lang to the root element, e.g. <html lang=\"en-IN\">.", effort: "S" },
    },
    {
      id: "og-tags",
      passed: missingOg.length === 0,
      title: `Missing Open Graph tags: ${missingOg.join(", ")}`,
      detail: "Open Graph tags control how links look when shared on social media and messaging apps.",
      severity: "low",
      fix: { title: "Add Open Graph tags", steps: "Add og:title, og:description and a 1200×630 og:image to every page.", effort: "S" },
    },
    {
      id: "image-alt",
      passed: missingAlt.length === 0,
      title: `${missingAlt.length} image${missingAlt.length === 1 ? "" : "s"} without alt text`,
      detail: "Alt text helps image search and is essential for screen-reader users.",
      severity: missingAlt.length > 5 ? "medium" : "low",
      evidence: missingAlt.slice(0, 5).join("\n") || undefined,
      fix: { title: "Add alt text to images", steps: "Describe meaningful images in a short phrase; use alt=\"\" for purely decorative ones.", effort: missingAlt.length > 20 ? "M" : "S" },
    },
    {
      id: "duplicate-titles",
      passed: duplicateTitles.length === 0,
      title: "Several pages share the same title",
      detail: "Unique titles help search engines tell pages apart.",
      severity: "medium",
      evidence: [...new Set(duplicateTitles)].join("\n") || undefined,
      fix: { title: "Give every page a unique title", steps: "Include the page's topic first, then the brand.", effort: "S" },
    },
    {
      id: "robots-txt",
      passed: files.robotsTxt !== null,
      title: "No robots.txt",
      detail: "robots.txt tells crawlers what to index and where your sitemap lives.",
      severity: "low",
      fix: { title: "Publish robots.txt", steps: "Serve /robots.txt with at least \"User-agent: *\", \"Allow: /\" and a \"Sitemap:\" line.", effort: "S" },
    },
    {
      id: "sitemap",
      passed: files.sitemapFound,
      title: "No sitemap.xml found",
      detail: "A sitemap helps search engines discover all your pages.",
      severity: "medium",
      fix: { title: "Generate a sitemap", steps: "Publish /sitemap.xml (most CMSs and frameworks can generate one) and reference it from robots.txt.", effort: "S" },
    },
  ];
};

const EFFORT_HINT = { S: "~30 min", M: "~half a day", L: "1–2 days" } as const;

export const seoResult = (lighthouseScore: number | null, pages: CrawledPage[], files: SiteFiles): CategoryResult => {
  const checks = seoChecks(pages, files);
  const failed = checks.filter((c) => !c.passed);
  const crawlScore = checks.length ? clampScore(((checks.length - failed.length) / checks.length) * 100) : null;
  const parts = [lighthouseScore, crawlScore].filter((s): s is number => s !== null);
  const score = parts.length ? clampScore(parts.reduce((a, b) => a + b, 0) / parts.length) : null;

  return {
    category: "seo",
    score,
    status: lighthouseScore !== null && crawlScore !== null ? "COMPLETE" : score === null ? "FAILED" : "PARTIAL",
    summary:
      score === null
        ? "SEO couldn't be measured."
        : `${checks.length - failed.length} of ${checks.length} on-page checks pass${lighthouseScore !== null ? `; Lighthouse SEO scores ${lighthouseScore}` : ""}.`,
    issues: failed
      .map((c) => ({ id: c.id, title: c.title, detail: c.detail, severity: c.severity, evidence: c.evidence }))
      .toSorted(bySeverity),
    fixes: failed.map((c) => ({
      issueId: c.id,
      title: c.fix.title,
      steps: c.fix.steps,
      priority: c.severity,
      effort: c.fix.effort,
      effortHint: EFFORT_HINT[c.fix.effort],
    })),
    toolsUsed: [...CATEGORIES.seo.tools],
    metrics: { lighthouse: lighthouseScore, checksPassed: checks.length - failed.length, checksTotal: checks.length },
  };
};
