"use client";

import { create } from "zustand";
import type { RpeRestBandId } from "@/lib/rest-by-rpe";

export type RestTimerMeta = {
  rpeBand: RpeRestBandId | null;
  prescribedRest: boolean;
  programExerciseIds: string[];
  canEditProgramRest: boolean;
};

type State = {
  restStartedAt: number | null;
  restEndsAt: number | null;
  restTargetSec: number;
  restMeta: RestTimerMeta | null;
  isRestRunning: boolean;
  libraryExerciseSlug: string | null;
  startRest: (sec: number, meta?: Partial<RestTimerMeta> | null) => void;
  adjustRestDelta: (deltaSec: number) => void;
  clearRest: () => void;
  tick: () => void;
  openLibrary: (slug: string | null) => void;
};

function recomputeTarget(startedAt: number, endsAt: number): number {
  return Math.max(1, Math.ceil((endsAt - startedAt) / 1000));
}

export const useWorkoutSessionStore = create<State>((set, get) => ({
  restStartedAt: null,
  restEndsAt: null,
  restTargetSec: 180,
  restMeta: null,
  isRestRunning: false,
  libraryExerciseSlug: null,

  startRest: (sec: number, meta?: Partial<RestTimerMeta> | null) => {
    const now = Date.now();
    const s = Math.max(1, Math.round(sec));
    const ends = now + s * 1000;
    const m = meta ?? {};
    const baseMeta: RestTimerMeta = {
      rpeBand: m.rpeBand !== undefined ? m.rpeBand : null,
      prescribedRest: m.prescribedRest ?? false,
      programExerciseIds: m.programExerciseIds ?? [],
      canEditProgramRest: m.canEditProgramRest ?? false,
    };
    set({
      restStartedAt: now,
      restEndsAt: ends,
      restTargetSec: s,
      restMeta: baseMeta,
      isRestRunning: true,
    });
  },

  adjustRestDelta: (deltaSec: number) => {
    const { restEndsAt, restStartedAt, isRestRunning } = get();
    if (!isRestRunning || restEndsAt == null || restStartedAt == null) return;
    const d = Math.round(deltaSec);
    if (!Number.isFinite(d) || d === 0) return;
    const now = Date.now();
    let nextEnd = restEndsAt + d * 1000;
    const minEnd = now + 10_000;
    if (nextEnd < minEnd) nextEnd = minEnd;
    const maxEnd = restStartedAt + 3600_000;
    if (nextEnd > maxEnd) nextEnd = maxEnd;
    set({
      restEndsAt: nextEnd,
      restTargetSec: recomputeTarget(restStartedAt, nextEnd),
    });
  },

  clearRest: () =>
    set({
      restStartedAt: null,
      restEndsAt: null,
      restMeta: null,
      isRestRunning: false,
    }),

  tick: () => {
    const { restEndsAt } = get();
    if (restEndsAt != null && Date.now() >= restEndsAt) {
      set({
        restStartedAt: null,
        restEndsAt: null,
        restMeta: null,
        isRestRunning: false,
      });
    }
  },

  openLibrary: (slug: string | null) => set({ libraryExerciseSlug: slug }),
}));
