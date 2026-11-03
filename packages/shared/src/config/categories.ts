import type { ToolId } from "./tools";

export const CATEGORY_IDS = [
  "performance",
  "devicePerformance",
  "slowLoading",
  "accessibility",
  "responsiveness",
  "seo",
  "aeo",
  "geo",
  "grammar",
  "features",
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export interface CategoryConfig {
  label: string;
  definition: string;
  tools: readonly ToolId[];
  /** Relative weight in the overall score. Weights are normalised, so they need not sum to 100. */
  weight: number;
}

/** Single source of truth for tooltips, reports and scoring weights. */
export const CATEGORIES: Record<CategoryId, CategoryConfig> = {
  performance: {
    label: "Performance",
    definition:
      "How fast the page loads and becomes usable, measured with Core Web Vitals (LCP, CLS, TBT) plus FCP and Speed Index.",
    tools: ["lighthouse"],
    weight: 15,
  },
  devicePerformance: {
    label: "Device-wise performance",
    definition: "How performance differs between mobile and desktop visitors, compared side by side.",
    tools: ["lighthouse"],
    weight: 8,
  },
  slowLoading: {
    label: "Slow-loading items",
    definition:
      "The specific resources holding the page back: oversized files, render-blocking assets and slow third-party scripts.",
    tools: ["lighthouse"],
    weight: 7,
  },
  accessibility: {
    label: "Accessibility",
    definition:
      "How usable the site is for people with disabilities, including screen-reader, keyboard and low-vision users (WCAG).",
    tools: ["lighthouse", "axe", "playwright"],
    weight: 15,
  },
  responsiveness: {
    label: "Responsiveness",
    definition: "Whether the layout adapts cleanly to phones, tablets and desktops without overflow or tiny tap targets.",
    tools: ["playwright", "ai"],
    weight: 12,
  },
  seo: {
    label: "SEO",
    definition:
      "How well search engines can discover, understand and rank the site: titles, meta tags, headings, sitemaps and more.",
    tools: ["lighthouse", "crawler"],
    weight: 12,
  },
  aeo: {
    label: "AEO",
    definition:
      "Answer Engine Optimization: how easily voice assistants and featured snippets can pull direct answers from your content.",
    tools: ["crawler", "ai"],
    weight: 8,
  },
  geo: {
    label: "GEO",
    definition:
      "Generative Engine Optimization: how likely AI assistants are to understand, trust and cite your site in generated answers.",
    tools: ["crawler", "ai"],
    weight: 8,
  },
  grammar: {
    label: "Grammar",
    definition: "Spelling, grammar and style issues in the visible text that can undermine credibility.",
    tools: ["languageTool", "ai"],
    weight: 7,
  },
  features: {
    label: "Features to add",
    definition: "How complete the site is for its goals and audience, compared with the conventions of similar sites.",
    tools: ["ai"],
    weight: 8,
  },
};
