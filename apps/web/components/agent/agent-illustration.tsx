"use client";

import { motion } from "motion/react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

type Mood = "working" | "done" | "failed";

const SPARKLES = [
  { x: 214, y: 14, delay: 0 },
  { x: 236, y: 56, delay: 0.7 },
  { x: 96, y: 22, delay: 1.3 },
];

/** A small robot scanning a browser window. Purely decorative. */
export function AgentIllustration({ mood, className }: { mood: Mood; className?: string }) {
  const still = usePrefersReducedMotion();
  const working = mood === "working" && !still;
  const loop = (duration: number, delay = 0) => ({ duration, delay, repeat: Infinity, ease: "easeInOut" as const });

  const accent = mood === "done" ? "fill-good" : mood === "failed" ? "fill-poor" : "fill-primary";

  return (
    <svg viewBox="0 0 250 160" aria-hidden className={cn("h-auto w-full max-w-sm", className)}>
      <defs>
        <linearGradient id="beam" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0" />
          <stop offset="60%" stopColor="var(--primary)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.9" />
        </linearGradient>
        <clipPath id="screen">
          <rect x="110" y="36" width="126" height="98" rx="4" />
        </clipPath>
      </defs>

      {/* browser window */}
      <rect x="104" y="18" width="138" height="122" rx="12" className="fill-card stroke-border" strokeWidth="2" />
      {[118, 128, 138].map((cx) => (
        <circle key={cx} cx={cx} cy="28" r="3" className="fill-muted-foreground/40" />
      ))}
      <g clipPath="url(#screen)">
        <rect x="116" y="42" width="72" height="9" rx="4" className="fill-foreground/70" />
        <rect x="116" y="57" width="104" height="5" rx="2.5" className="fill-muted-foreground/40" />
        <rect x="116" y="67" width="88" height="5" rx="2.5" className="fill-muted-foreground/40" />
        <rect x="116" y="82" width="50" height="40" rx="6" className="fill-primary/20" />
        <rect x="172" y="82" width="50" height="40" rx="6" className="fill-primary/20" />
        {working && (
          <motion.rect
            x="110"
            width="126"
            height="26"
            fill="url(#beam)"
            initial={{ y: 12 }}
            animate={{ y: [12, 110, 12] }}
            transition={loop(3.2)}
          />
        )}
      </g>

      {/* robot */}
      <motion.g animate={working ? { y: [0, -3, 0] } : { y: 0 }} transition={loop(2.4)}>
        <line x1="50" y1="40" x2="50" y2="26" className="stroke-muted-foreground" strokeWidth="3" strokeLinecap="round" />
        <motion.circle
          cx="50"
          cy="22"
          r="6"
          className={accent}
          animate={working ? { opacity: [1, 0.35, 1] } : { opacity: 1 }}
          transition={loop(1.4)}
        />
        <rect x="22" y="40" width="56" height="42" rx="14" className={accent} />
        <rect x="30" y="50" width="40" height="22" rx="9" className="fill-background/90" />
        {mood === "done" ? (
          <>
            <path d="M37 63 l4 -5 l4 5" className="stroke-good" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M55 63 l4 -5 l4 5" className="stroke-good" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </>
        ) : (
          [41, 59].map((cx) => (
            <motion.ellipse
              key={cx}
              cx={cx}
              cy="61"
              rx="4"
              ry="4.5"
              className={mood === "failed" ? "fill-poor" : "fill-foreground"}
              style={{ originY: "61px" }}
              animate={working ? { scaleY: [1, 1, 0.1, 1] } : { scaleY: 1 }}
              transition={{ duration: 3.5, times: [0, 0.9, 0.95, 1], repeat: Infinity }}
            />
          ))
        )}
        <rect x="28" y="86" width="44" height="40" rx="12" className="fill-muted stroke-border" strokeWidth="2" />
        <rect x="40" y="96" width="20" height="6" rx="3" className={cn(accent, "opacity-60")} />
        {/* arm + magnifier */}
        <motion.g
          animate={working ? { x: [0, 10, 0], y: [0, -8, 0] } : { x: 0, y: 0 }}
          transition={loop(2.8)}
        >
          <line x1="72" y1="98" x2="98" y2="88" className="stroke-muted-foreground" strokeWidth="4" strokeLinecap="round" />
          <circle cx="110" cy="80" r="13" className="fill-primary/10 stroke-foreground" strokeWidth="3.5" />
          <line x1="101" y1="89" x2="96" y2="95" className="stroke-foreground" strokeWidth="5" strokeLinecap="round" />
        </motion.g>
      </motion.g>

      {SPARKLES.map(({ x, y, delay }) => (
        <motion.path
          key={`${x}-${y}`}
          d={`M${x} ${y - 6} L${x + 1.5} ${y - 1.5} L${x + 6} ${y} L${x + 1.5} ${y + 1.5} L${x} ${y + 6} L${x - 1.5} ${y + 1.5} L${x - 6} ${y} L${x - 1.5} ${y - 1.5} Z`}
          className="fill-primary"
          initial={{ opacity: still ? 0.6 : 0 }}
          animate={working ? { opacity: [0, 1, 0], scale: [0.6, 1, 0.6] } : { opacity: mood === "done" ? 0.8 : 0.3 }}
          transition={loop(2, delay)}
        />
      ))}
    </svg>
  );
}
