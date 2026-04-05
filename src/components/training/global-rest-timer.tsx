"use client";

import { RestTimerRing } from "@/components/training/rest-timer";

/** Keeps rest countdown, completion timeout, and alerts active on any route. */
export function GlobalRestTimer() {
  return <RestTimerRing />;
}
