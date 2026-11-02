import type { CSSProperties } from "react";

// Deterministic pseudo-random layout so server and client render the same particles.
const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  bottom: `${(i * 53) % 60}%`,
  size: 2 + (i % 3),
  delay: `${(i * 0.73) % 8}s`,
  duration: `${7 + (i % 5)}s`,
}));

/** Aurora gradient, drifting grid and floating particles. Animations are off under prefers-reduced-motion. */
export function AgentBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-aurora" />
      <div className="absolute inset-0 bg-grid animate-grid-drift" />
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="animate-particle absolute rounded-full bg-primary/60 opacity-0 motion-reduce:opacity-30"
          style={
            {
              left: p.left,
              bottom: p.bottom,
              width: p.size,
              height: p.size,
              animationDelay: p.delay,
              "--particle-duration": p.duration,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
