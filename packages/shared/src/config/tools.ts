export const TOOLS = {
  lighthouse: { name: "Lighthouse", description: "Google's automated auditing tool for performance, accessibility and SEO." },
  playwright: { name: "Playwright", description: "Headless browser used to render pages and capture screenshots." },
  axe: { name: "axe-core", description: "Industry-standard accessibility rules engine (WCAG 2.x)." },
  crawler: { name: "Crawler", description: "Fetches HTML, robots.txt and sitemap.xml to inspect markup and metadata." },
  languageTool: { name: "LanguageTool", description: "Open-source grammar, spelling and style checker." },
  /** Placeholder in category config for "whichever AI model is configured"; saved results name the real one. */
  ai: { name: "AI model", description: "A large language model, used for content analysis and judgement calls." },
  gemini: { name: "Gemini", description: "Google's model, used for content analysis and judgement calls." },
  claude: { name: "Claude", description: "Anthropic's model, used for content analysis and judgement calls." },
} as const;

export type ToolId = keyof typeof TOOLS;
