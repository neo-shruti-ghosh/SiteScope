"use client";

import { Monitor, Smartphone, Tablet } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

const SLOTS = [375, 768, 1024, 1440] as const;

const deviceIcon = (width: number) => (width < 768 ? Smartphone : width < 1440 ? Tablet : Monitor);

/** Thumbnails pop in as Playwright captures each viewport; empty slots show what's coming. */
export function ScreenshotStrip({ screenshots }: { screenshots: { width: number; url: string }[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {SLOTS.map((width) => {
        const shot = screenshots.find((s) => s.width === width);
        const Icon = deviceIcon(width);
        return (
          <li key={width} className="flex flex-col gap-1.5">
            <div className="relative aspect-[4/3] overflow-hidden rounded-lg border bg-muted/40">
              <AnimatePresence>
                {shot ? (
                  <motion.img
                    key="shot"
                    src={shot.url}
                    alt={`Screenshot at ${width}px wide`}
                    className="absolute inset-0 size-full object-cover object-top"
                    initial={{ opacity: 0, scale: 1.08 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.45 }}
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-muted-foreground/60">
                    <Icon className="size-6" aria-hidden />
                  </div>
                )}
              </AnimatePresence>
            </div>
            <span className="text-center text-xs text-muted-foreground tabular-nums">{width}px</span>
          </li>
        );
      })}
    </ul>
  );
}
