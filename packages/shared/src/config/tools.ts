export const TOOLS = {
  lighthouse: { name: "Lighthouse", description: "Google's automated auditing tool for performance, accessibility and SEO." },
  playwright: { name: "Playwright", description: "Headless browser used to render pages and capture screenshots." },
  axe: { name: "axe-core", description: "Industry-standard accessibility rules engine (WCAG 2.x)." },
  crawler: { name: "Crawler", description: "Fetches HTML, robots.txt and sitemap.xml to inspect markup and metadata." },
  languageTool: { name: "LanguageTool", description: "Open-source grammar, spelling and style checker." },
  claude: { name: "Claude", description: "Anthropic's model, used for content analysis and judgement calls." },
} as const;

export type ToolId = keyof typeof TOOLS;
