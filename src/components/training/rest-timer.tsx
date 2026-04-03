"use client";

import { useEffect, useState } from "react";
import { useWorkoutSessionStore } from "@/stores/workout-session-store";

export function RestTimerRing() {
  const restEndsAt = useWorkoutSessionStore((s) => s.restEndsAt);
  const restDurationSec = useWorkoutSessionStore((s) => s.restDurationSec);
  const isRunning = useWorkoutSessionStore((s) => s.isRestRunning);
  const tick = useWorkoutSessionStore((s) => s.tick);
  const clearRest = useWorkoutSessionStore((s) => s.clearRest);

  /** Drives countdown UI; store `tick` alone does not re-render until the timer ends. */
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      setNow(Date.now());
      tick();
    }, 250);
    return () => clearInterval(id);
  }, [isRunning, tick]);

  if (!isRunning || restEndsAt == null) return null;
  const total = restDurationSec * 1000;
  const left = Math.max(0, restEndsAt - now);
  const pct = 1 - left / total;
  const secLeft = Math.ceil(left / 1000);

  const r = 44;
  const c = 2 * Math.PI * r;
  const dash = c * (1 - pct);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => clearRest()}
        className="relative flex size-24 items-center justify-center rounded-full bg-card shadow-lg border"
        aria-label="Dismiss rest timer"
      >
        <svg className="absolute size-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" className="stroke-muted" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            className="stroke-primary transition-all"
            strokeWidth="8"
            strokeDasharray={c}
            strokeDashoffset={dash}
            strokeLinecap="round"
          />
        </svg>
        <span className="relative font-mono text-lg font-semibold tabular-nums">{secLeft}s</span>
      </button>
      <span className="text-muted-foreground text-xs">Rest</span>
    </div>
  );
}
