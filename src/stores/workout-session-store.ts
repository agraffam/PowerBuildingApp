"use client";

import { create } from "zustand";

type State = {
  restEndsAt: number | null;
  restDurationSec: number;
  isRestRunning: boolean;
  libraryExerciseSlug: string | null;
  startRest: (sec: number) => void;
  clearRest: () => void;
  tick: () => void;
  openLibrary: (slug: string | null) => void;
};

export const useWorkoutSessionStore = create<State>((set, get) => ({
  restEndsAt: null,
  restDurationSec: 180,
  isRestRunning: false,
  libraryExerciseSlug: null,

  startRest: (sec: number) => {
    const ends = Date.now() + sec * 1000;
    set({ restEndsAt: ends, restDurationSec: sec, isRestRunning: true });
  },

  clearRest: () => set({ restEndsAt: null, isRestRunning: false }),

  tick: () => {
    const { restEndsAt } = get();
    if (restEndsAt != null && Date.now() >= restEndsAt) {
      set({ restEndsAt: null, isRestRunning: false });
    }
  },

  openLibrary: (slug: string | null) => set({ libraryExerciseSlug: slug }),
}));
