import { CATEGORIES, type CategoryId } from "@sitescope/shared";
import { CircleHelp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** The "?" next to a category name. Opens on hover and keyboard focus; screen readers get the definition as its description. */
export function CategoryInfo({ category }: { category: CategoryId }) {
  const { label, definition } = CATEGORIES[category];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`What is ${label}?`}
          className="grid size-6 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <CircleHelp className="size-4" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-pretty">{definition}</TooltipContent>
    </Tooltip>
  );
}
