import type { UiIdea } from "@sitescope/shared";
import { Lightbulb } from "lucide-react";
import { EffortBadge, SeverityBadge } from "./badges";

/** "Ideas to improve UI/UX": suggested features and enhancements from Claude. */
export function IdeasSection({ ideas }: { ideas: UiIdea[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {ideas.map((idea) => (
        <li key={idea.title} className="flex flex-col gap-2 rounded-xl border bg-background/60 p-4">
          <div className="flex items-start gap-2">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-average" aria-hidden />
            <h3 className="font-medium leading-snug">{idea.title}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{idea.description}</p>
          <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
            <SeverityBadge severity={idea.impact} suffix=" impact" />
            <EffortBadge effort={idea.effort} />
          </div>
        </li>
      ))}
    </ul>
  );
}
