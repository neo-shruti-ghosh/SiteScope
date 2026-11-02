"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { scoreStrokeClass } from "@/lib/format";
import { cn } from "@/lib/utils";

interface RadialGaugeProps {
  score: number | null;
  /** Rendered size in px. */
  size?: number;
  strokeWidth?: number;
  className?: string;
  /** Optional content centred inside the ring. */
  children?: ReactNode;
}

/** Score ring coloured by band (green ≥ 90, amber ≥ 50, red below). Decorative: pair it with visible text. */
export function RadialGauge({ score, size = 36, strokeWidth = 4, className, children }: RadialGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className={cn("relative grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth} className="stroke-muted" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={scoreStrokeClass(score)}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - (score ?? 0) / 100) }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.15 }}
        />
      </svg>
      {children && <div className="relative">{children}</div>}
    </div>
  );
}
