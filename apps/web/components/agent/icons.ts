import type { AuditEvent, NodeId, ToolId } from "@sitescope/shared";
import {
  Accessibility,
  BadgeCheck,
  Calculator,
  Camera,
  CircleCheck,
  CircleX,
  FileText,
  Gauge,
  Globe,
  Info,
  type LucideIcon,
  MonitorSmartphone,
  PartyPopper,
  Search,
  ShieldCheck,
  Sparkles,
  SpellCheck,
  TriangleAlert,
  Wrench,
} from "lucide-react";

export const NODE_ICONS: Record<NodeId, LucideIcon> = {
  validateUrl: ShieldCheck,
  crawl: Globe,
  lighthouse: Gauge,
  accessibility: Accessibility,
  responsiveness: MonitorSmartphone,
  seo: Search,
  grammar: SpellCheck,
  llmAnalysis: Sparkles,
  scoreAggregator: Calculator,
  reportWriter: FileText,
};

export const TOOL_ICONS: Record<ToolId, LucideIcon> = {
  lighthouse: Gauge,
  playwright: Camera,
  axe: Accessibility,
  crawler: Globe,
  languageTool: SpellCheck,
  claude: Sparkles,
};

const isToolId = (tool: string): tool is ToolId => tool in TOOL_ICONS;

export type Tone = "neutral" | "primary" | "good" | "average" | "poor";

/** Icon and colour tone for one activity-feed entry. */
export const eventVisual = (event: AuditEvent): { icon: LucideIcon; tone: Tone } => {
  switch (event.type) {
    case "tool_called":
      return { icon: isToolId(event.data.tool) ? TOOL_ICONS[event.data.tool] : Wrench, tone: "primary" };
    case "finding": {
      const severity = event.data?.severity ?? "info";
      if (severity === "high") return { icon: TriangleAlert, tone: "poor" };
      if (severity === "medium") return { icon: TriangleAlert, tone: "average" };
      return { icon: Info, tone: "neutral" };
    }
    case "node_started":
      return { icon: event.node ? NODE_ICONS[event.node] : Info, tone: "neutral" };
    case "node_completed":
      return { icon: CircleCheck, tone: "good" };
    case "category_result":
      return { icon: BadgeCheck, tone: "primary" };
    case "screenshot":
      return { icon: Camera, tone: "primary" };
    case "audit_completed":
      return { icon: PartyPopper, tone: "good" };
    case "error":
    case "audit_failed":
      return { icon: CircleX, tone: "poor" };
  }
};

export const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary/12 text-primary",
  good: "bg-good/12 text-good",
  average: "bg-average/12 text-average",
  poor: "bg-poor/12 text-poor",
};
