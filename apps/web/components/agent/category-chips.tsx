"use client";

import { CATEGORIES, CATEGORY_IDS, type CategoryId } from "@sitescope/shared";
import { LoaderCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { Chip } from "@/lib/audit-stream";
import { RadialGauge } from "@/components/results/radial-gauge";
import { scoreTextClass } from "@/lib/format";
import { cn } from "@/lib/utils";

function ChipFace({ chip }: { chip: Chip }) {
  if (chip.state === "pending") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="size-1.5 rounded-full bg-muted-foreground/50" aria-hidden />
        Pending
      </span>
    );
  }
  if (chip.state === "scanning") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
        <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
        Scanning
      </span>
    );
  }
  if (chip.score === null) {
    return <span className="text-xs text-muted-foreground">Not scored</span>;
  }
  return (
    <span className="flex items-center gap-2">
      <RadialGauge score={chip.score} />
      <span className={cn("text-lg font-semibold tabular-nums", scoreTextClass(chip.score))}>
        {chip.score}
        {chip.status === "PARTIAL" && <span className="ml-1 text-xs font-normal text-muted-foreground">partial</span>}
      </span>
    </span>
  );
}

const describe = (chip: Chip) =>
  chip.state === "done" ? (chip.score === null ? "not scored" : `${chip.score} out of 100`) : chip.state;

/** One chip per category that flips pending → scanning → score as results arrive. */
export function CategoryChips({ chips }: { chips: Record<CategoryId, Chip> }) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {CATEGORY_IDS.map((id) => {
        const chip = chips[id];
        return (
          <li
            key={id}
            className={cn(
              "flex min-h-24 flex-col justify-between gap-2 rounded-xl border bg-background/50 p-3 transition-colors duration-500 [perspective:600px]",
              chip.state === "scanning" && "border-primary/50",
            )}
          >
            <span className="text-xs font-medium leading-tight">{CATEGORIES[id].label}</span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={chip.state}
                initial={{ rotateX: -90, opacity: 0 }}
                animate={{ rotateX: 0, opacity: 1 }}
                exit={{ rotateX: 90, opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <ChipFace chip={chip} />
              </motion.div>
            </AnimatePresence>
            <span className="sr-only">
              {CATEGORIES[id].label}: {describe(chip)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
