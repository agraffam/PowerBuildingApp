"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  playRestCountdownBeepFinalSecond,
  playRestCountdownBeepShort,
  unlockRestTimerAudio,
} from "@/lib/play-rest-complete-beep";
import { maybeAskRestNotificationPermission, tryRestCompleteNotify } from "@/lib/rest-timer-notify";
import {
  applyBandRestSec,
  mergeRestDurationsByRpe,
  RPE_BAND_LABELS,
  snapProgramRestSec,
  snapRestSecToOption,
  type RpeRestBandId,
} from "@/lib/rest-by-rpe";
import { useWorkoutSessionStore } from "@/stores/workout-session-store";

type Props = {
  /** When omitted, uses `restSessionId` from the store (set when rest starts from a workout). */
  sessionId?: string;
};

export function RestTimerRing({ sessionId: propSessionId }: Props) {
  const qc = useQueryClient();
  const restStartedAt = useWorkoutSessionStore((s) => s.restStartedAt);
  const restEndsAt = useWorkoutSessionStore((s) => s.restEndsAt);
  const restTargetSec = useWorkoutSessionStore((s) => s.restTargetSec);
  const restMeta = useWorkoutSessionStore((s) => s.restMeta);
  const restSessionId = useWorkoutSessionStore((s) => s.restSessionId);
  const isRunning = useWorkoutSessionStore((s) => s.isRestRunning);
  const clearRest = useWorkoutSessionStore((s) => s.clearRest);
  const adjustRestDelta = useWorkoutSessionStore((s) => s.adjustRestDelta);

  const effectiveSessionId = propSessionId ?? restSessionId ?? "";

  const [now, setNow] = useState(() => Date.now());
  const beepedForPeriodRef = useRef(false);
  const countdownBeepsRef = useRef<{ end: number | null; s3: boolean; s2: boolean; s1: boolean }>({
    end: null,
    s3: false,
    s2: false,
    s1: false,
  });

  const finalizeRestIfDue = useCallback(() => {
    const s = useWorkoutSessionStore.getState();
    if (!s.isRestRunning || s.restEndsAt == null || Date.now() < s.restEndsAt) return;
    if (beepedForPeriodRef.current) return;
    beepedForPeriodRef.current = true;
    tryRestCompleteNotify();
    s.tick();
  }, []);

  /** Reset countdown beep flags when rest ends or target time changes (e.g. ±15s). */
  useEffect(() => {
    if (!isRunning || restEndsAt == null) {
      countdownBeepsRef.current = { end: null, s3: false, s2: false, s1: false };
      return;
    }
    countdownBeepsRef.current = {
      end: restEndsAt,
      s3: false,
      s2: false,
      s1: false,
    };
  }, [isRunning, restEndsAt]);

  const maybePlayCountdownBeeps = useCallback((activeEnd: number) => {
    const r = countdownBeepsRef.current;
    if (r.end !== activeEnd) return;
    const leftMs = activeEnd - Date.now();
    if (leftMs <= 0) return;
    const secLeft = Math.ceil(leftMs / 1000);
    if (secLeft === 3 && !r.s3) {
      r.s3 = true;
      playRestCountdownBeepShort();
    }
    if (secLeft === 2 && !r.s2) {
      r.s2 = true;
      playRestCountdownBeepShort();
    }
    if (secLeft === 1 && !r.s1) {
      r.s1 = true;
      const durSec = Math.min(1, Math.max(0.08, leftMs / 1000));
      playRestCountdownBeepFinalSecond(durSec);
    }
  }, []);

  /** Safari / iOS: AudioContext stays suspended until a user gesture; unlock on any tap. */
  useEffect(() => {
    const u = () => {
      unlockRestTimerAudio();
      maybeAskRestNotificationPermission();
    };
    window.addEventListener("pointerdown", u, { capture: true, passive: true });
    window.addEventListener("touchstart", u, { capture: true, passive: true });
    return () => {
      window.removeEventListener("pointerdown", u, true);
      window.removeEventListener("touchstart", u, true);
    };
  }, []);

  /** Fire completion at deadline even when the tab is throttling timers (single long timeout). */
  useEffect(() => {
    if (!isRunning || restEndsAt == null) return;
    const end = restEndsAt;
    const delay = Math.max(0, end - Date.now());
    const id = window.setTimeout(() => {
      const s = useWorkoutSessionStore.getState();
      if (!s.isRestRunning || s.restEndsAt !== end) return;
      finalizeRestIfDue();
    }, delay);
    return () => clearTimeout(id);
  }, [isRunning, restEndsAt, finalizeRestIfDue]);

  const { data: settingsData } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const r = await fetch("/api/settings");
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<{
        restDurationsByRpe: Record<string, number>;
        defaultRestSec: number;
      }>;
    },
    enabled: isRunning && restMeta?.rpeBand != null,
    staleTime: 60_000,
  });

  const saveBand = useMutation({
    mutationFn: async (body: { restDurationsByRpe: Record<string, number> }) => {
      const r = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Save failed");
      return r.json();
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["settings"] });
      if (effectiveSessionId) void qc.invalidateQueries({ queryKey: ["session", effectiveSessionId] });
    },
  });

  const saveProgramRest = useMutation({
    mutationFn: async ({ ids, restSec }: { ids: string[]; restSec: number }) => {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/program-exercises/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ restSec }),
          }).then((r) => {
            if (!r.ok) throw new Error("Update failed");
          }),
        ),
      );
    },
    onSuccess: () => {
      if (effectiveSessionId) void qc.invalidateQueries({ queryKey: ["session", effectiveSessionId] });
    },
  });

  useEffect(() => {
    if (!isRunning) {
      beepedForPeriodRef.current = false;
      return;
    }
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      const end = useWorkoutSessionStore.getState().restEndsAt;
      if (end != null) maybePlayCountdownBeeps(end);
      finalizeRestIfDue();
    }, 250);
    return () => clearInterval(id);
  }, [isRunning, finalizeRestIfDue, maybePlayCountdownBeeps]);

  if (!isRunning || restEndsAt == null || restStartedAt == null) return null;

  const totalMs = Math.max(1, restEndsAt - restStartedAt);
  const leftMs = Math.max(0, restEndsAt - now);
  const pct = 1 - leftMs / totalMs;
  const secLeft = Math.ceil(leftMs / 1000);

  const r = 44;
  const c = 2 * Math.PI * r;
  const dash = c * (1 - pct);

  const band = restMeta?.rpeBand ?? null;
  const canSaveBand = band != null && settingsData?.restDurationsByRpe != null;
  const canSaveProgram =
    restMeta?.prescribedRest === true &&
    restMeta.canEditProgramRest === true &&
    restMeta.programExerciseIds.length > 0;

  const onSaveBand = () => {
    if (band == null || !settingsData?.restDurationsByRpe) return;
    const merged = mergeRestDurationsByRpe(
      settingsData.restDurationsByRpe,
      settingsData.defaultRestSec ?? 180,
    );
    const snapped = snapRestSecToOption(restTargetSec);
    const next = applyBandRestSec(merged, band as RpeRestBandId, snapped);
    saveBand.mutate({ restDurationsByRpe: next });
  };

  const onSaveProgram = () => {
    if (!restMeta?.programExerciseIds.length) return;
    const sec = snapProgramRestSec(restTargetSec);
    saveProgramRest.mutate({ ids: restMeta.programExerciseIds, restSec: sec });
  };

  const pending = saveBand.isPending || saveProgramRest.isPending;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex max-w-[min(100vw-2rem,280px)] flex-col items-center gap-2">
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
      <span className="text-muted-foreground text-xs">Rest (~{restTargetSec}s)</span>
      <div className="flex flex-wrap justify-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 rounded-lg px-2"
          disabled={pending}
          onClick={() => adjustRestDelta(-15)}
          aria-label="Subtract 15 seconds from rest"
        >
          <Minus className="size-4" />
          15s
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 rounded-lg px-2"
          disabled={pending}
          onClick={() => adjustRestDelta(15)}
          aria-label="Add 15 seconds to rest"
        >
          <Plus className="size-4" />
          15s
        </Button>
      </div>
      <div className="flex flex-col gap-1 w-full">
        {canSaveBand && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-lg text-xs w-full gap-2"
            disabled={pending}
            onClick={() => onSaveBand()}
          >
            {saveBand.isPending ? <Loader2 className="size-3 animate-spin shrink-0" /> : null}
            <span>Save for {RPE_BAND_LABELS[band as RpeRestBandId]}</span>
          </Button>
        )}
        {canSaveProgram && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-lg text-xs w-full gap-2"
            disabled={pending}
            onClick={() => onSaveProgram()}
          >
            {saveProgramRest.isPending ? <Loader2 className="size-3 animate-spin shrink-0" /> : null}
            <span>Save programmed rest for lifts</span>
          </Button>
        )}
      </div>
    </div>
  );
}
