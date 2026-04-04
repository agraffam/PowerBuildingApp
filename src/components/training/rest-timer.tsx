"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Loader2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playRestCompleteBeep } from "@/lib/play-rest-complete-beep";
import {
  applyBandRestSec,
  mergeRestDurationsByRpe,
  RPE_BAND_LABELS,
  snapProgramRestSec,
  snapRestSecToOption,
  type RpeRestBandId,
} from "@/lib/rest-by-rpe";
import { useWorkoutSessionStore } from "@/stores/workout-session-store";

export function RestTimerRing({ sessionId }: { sessionId: string }) {
  const qc = useQueryClient();
  const restStartedAt = useWorkoutSessionStore((s) => s.restStartedAt);
  const restEndsAt = useWorkoutSessionStore((s) => s.restEndsAt);
  const restTargetSec = useWorkoutSessionStore((s) => s.restTargetSec);
  const restMeta = useWorkoutSessionStore((s) => s.restMeta);
  const isRunning = useWorkoutSessionStore((s) => s.isRestRunning);
  const tick = useWorkoutSessionStore((s) => s.tick);
  const clearRest = useWorkoutSessionStore((s) => s.clearRest);
  const adjustRestDelta = useWorkoutSessionStore((s) => s.adjustRestDelta);

  const [now, setNow] = useState(() => Date.now());
  const beepedForPeriodRef = useRef(false);

  const { data: settingsData } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const r = await fetch("/api/settings");
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<{ restDurationsByRpe: Record<string, number> }>;
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
      void qc.invalidateQueries({ queryKey: ["session", sessionId] });
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
      void qc.invalidateQueries({ queryKey: ["session", sessionId] });
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
      if (restEndsAt != null && t >= restEndsAt && !beepedForPeriodRef.current) {
        beepedForPeriodRef.current = true;
        playRestCompleteBeep();
      }
      tick();
    }, 250);
    return () => clearInterval(id);
  }, [isRunning, tick, restEndsAt]);

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
    const merged = mergeRestDurationsByRpe(settingsData.restDurationsByRpe);
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
