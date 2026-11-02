"use client";

import { type AuditEvent, NODES } from "@sitescope/shared";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { eventVisual, TONE_CLASSES } from "./icons";

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function FeedItem({ event }: { event: AuditEvent }) {
  const { icon: Icon, tone } = eventVisual(event);
  return (
    // Growing from zero height pushes older entries down smoothly instead of overlapping them.
    <motion.li
      initial={{ opacity: 0, x: -24, height: 0 }}
      animate={{ opacity: 1, x: 0, height: "auto" }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className="overflow-hidden"
    >
      <div className="flex items-start gap-3 py-2">
        <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg", TONE_CLASSES[tone])}>
          <Icon className="size-3.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug">{event.message}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {event.node && <span>{NODES[event.node].label} · </span>}
            <time dateTime={event.ts}>{timeOf(event.ts)}</time>
          </p>
        </div>
      </div>
    </motion.li>
  );
}

/** Live log of agent events, newest on top. */
export function ActivityFeed({ events }: { events: AuditEvent[] }) {
  return (
    <ol aria-label="Agent activity" className="flex flex-col divide-y divide-border/60">
      <AnimatePresence initial={false}>
        {events.map((event) => (
          <FeedItem key={event.seq} event={event} />
        ))}
      </AnimatePresence>
      {events.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Waiting for the agent…</li>}
    </ol>
  );
}
