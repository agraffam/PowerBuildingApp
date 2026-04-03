"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, Loader2, Trophy } from "lucide-react";
import type { WeightUnit } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { displayFromKg } from "@/lib/calculators";
import { cn } from "@/lib/utils";

export type SessionCompleteSummaryPayload = {
  programDayLabel: string;
  weekIndex: number;
  readiness: { sleep: number; stress: number; soreness: number } | null;
  intensityMultiplier: number;
  durationSec: number | null;
  totalVolumeKg: number;
  displayUnit: WeightUnit;
  volumeByExercise: {
    exerciseId: string;
    name: string;
    volumeKg: number;
    topSetLabel: string;
  }[];
  prs: {
    exerciseId: string;
    name: string;
    estimatedOneRmDisplay: number;
    previousOneRmDisplay: number | null;
  }[];
  strengthSuggestions: {
    exerciseId: string;
    name: string;
    suggestedOneRmDisplay: number;
    previousOneRmDisplay: number | null;
    isPr: boolean;
  }[];
  completedWorkoutCount: number;
  workoutStartedAt: string | null;
  workoutCompletedAt: string;
};

function formatDuration(sec: number | null): string {
  if (sec == null || sec < 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m <= 0) return `${s}s`;
  return `${m}m ${s}s`;
}

type Props = {
  open: boolean;
  summary: SessionCompleteSummaryPayload;
  sessionId: string;
  onClose: () => void;
};

export function SessionCompleteSplash({ open, summary, sessionId, onClose }: Props) {
  const qc = useQueryClient();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [skippedStrength, setSkippedStrength] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setSkippedStrength(false);
    setSavedIds(new Set());
    setSelected(new Set(summary.strengthSuggestions.map((s) => s.exerciseId)));
  }, [open, summary.workoutCompletedAt, summary.strengthSuggestions]);

  const saveOne = useMutation({
    mutationFn: async (p: { exerciseId: string; oneRm: number }) => {
      const r = await fetch(`/api/strength/${p.exerciseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          estimatedOneRm: p.oneRm,
          weightUnit: summary.displayUnit,
        }),
      });
      if (r.status === 401) {
        window.location.assign("/login");
        throw new Error("Unauthorized");
      }
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Save failed");
      }
      return p.exerciseId;
    },
    onSuccess: (exerciseId) => {
      setSavedIds((prev) => new Set(prev).add(exerciseId));
      void qc.invalidateQueries({ queryKey: ["session", sessionId] });
      void qc.invalidateQueries({ queryKey: ["training-active"] });
      void qc.invalidateQueries({ queryKey: ["strength"] });
    },
  });

  const [saveAllPending, setSaveAllPending] = useState(false);

  async function handleSaveSelected() {
    setSaveAllPending(true);
    try {
      const next = new Set(savedIds);
      for (const s of summary.strengthSuggestions) {
        if (!selected.has(s.exerciseId) || next.has(s.exerciseId)) continue;
        const r = await fetch(`/api/strength/${s.exerciseId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            estimatedOneRm: s.suggestedOneRmDisplay,
            weightUnit: summary.displayUnit,
          }),
        });
        if (r.status === 401) {
          window.location.assign("/login");
          return;
        }
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? "Save failed");
        }
        next.add(s.exerciseId);
      }
      setSavedIds(next);
      void qc.invalidateQueries({ queryKey: ["session", sessionId] });
      void qc.invalidateQueries({ queryKey: ["training-active"] });
      void qc.invalidateQueries({ queryKey: ["strength"] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed";
      window.alert(msg);
    } finally {
      setSaveAllPending(false);
    }
  }

  const totalVolDisplay = displayFromKg(summary.totalVolumeKg, summary.displayUnit);
  const unitLabel = summary.displayUnit === "KG" ? "kg" : "lb";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "w-[calc(100vw-1.5rem)] max-w-xl max-h-[min(100dvh-2rem,800px)] overflow-y-auto rounded-2xl gap-0 p-0 sm:w-full",
        )}
      >
        <div className="px-6 pt-8 pb-6 space-y-6">
          <DialogHeader className="text-left space-y-2">
            <DialogTitle className="text-2xl sm:text-3xl font-heading pr-8">
              Workout complete
            </DialogTitle>
            <DialogDescription className="text-base text-foreground">
              <span className="font-medium">{summary.programDayLabel}</span>
              <span className="text-muted-foreground"> · Week {summary.weekIndex + 1}</span>
            </DialogDescription>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Lifetime completed workouts (all programs):{" "}
            <span className="font-semibold text-foreground tabular-nums">{summary.completedWorkoutCount}</span>
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border bg-muted/30 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Duration</p>
              <p className="text-xl font-semibold tabular-nums mt-1">{formatDuration(summary.durationSec)}</p>
            </div>
            <div className="rounded-xl border bg-muted/30 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total volume</p>
              <p className="text-xl font-semibold tabular-nums mt-1">
                {Math.round(totalVolDisplay)} {unitLabel}
              </p>
            </div>
          </div>

          {summary.readiness && (
            <div className="rounded-xl border px-4 py-3 space-y-1 text-sm">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Readiness</p>
              <p>
                Sleep {summary.readiness.sleep}/10 · Stress {summary.readiness.stress}/10 · Soreness{" "}
                {summary.readiness.soreness}/10
              </p>
              <p className="text-muted-foreground text-xs">
                Intensity multiplier ×{summary.intensityMultiplier.toFixed(2)}
              </p>
            </div>
          )}

          {summary.prs.length > 0 && (
            <div
              className={cn(
                "rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-orange-500/5 px-4 py-4",
                "motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-500",
              )}
            >
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <Trophy className="size-6 shrink-0" />
                <p className="font-heading font-semibold text-lg">New PRs</p>
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                {summary.prs.map((p) => (
                  <li key={p.exerciseId}>
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      — est. 1RM {p.estimatedOneRmDisplay} {unitLabel}
                      {p.previousOneRmDisplay != null && (
                        <span> (was {p.previousOneRmDisplay})</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.volumeByExercise.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Volume by exercise</p>
              <ul className="rounded-xl border divide-y max-h-48 overflow-y-auto">
                {summary.volumeByExercise.map((row) => (
                  <li key={row.exerciseId} className="px-3 py-2.5 text-sm flex flex-col gap-0.5">
                    <span className="font-medium">{row.name}</span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {Math.round(displayFromKg(row.volumeKg, summary.displayUnit))} {unitLabel}
                      {row.topSetLabel ? ` · ${row.topSetLabel}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!skippedStrength && summary.strengthSuggestions.length > 0 && (
            <div className="space-y-3 rounded-xl border bg-card p-4">
              <div className="flex flex-col gap-1">
                <p className="font-medium text-sm">Update strength profiles?</p>
                <p className="text-muted-foreground text-xs">
                  Estimated 1RM from this session (RPE chart). Save to improve future %1RM suggestions, or skip.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="rounded-xl"
                  disabled={saveAllPending || saveOne.isPending}
                  onClick={() => void handleSaveSelected()}
                >
                  {saveAllPending ? <Loader2 className="size-4 animate-spin" /> : "Save selected"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setSkippedStrength(true)}
                >
                  Skip updates
                </Button>
              </div>
              <ul className="space-y-2">
                {summary.strengthSuggestions.map((s) => {
                  const isSel = selected.has(s.exerciseId);
                  const done = savedIds.has(s.exerciseId);
                  return (
                    <li
                      key={s.exerciseId}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border bg-background/80 px-3 py-2"
                    >
                      <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-input"
                          checked={isSel}
                          disabled={done}
                          onChange={() => {
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(s.exerciseId)) next.delete(s.exerciseId);
                              else next.add(s.exerciseId);
                              return next;
                            });
                          }}
                        />
                        <span className="text-sm">
                          <span className="font-medium">{s.name}</span>
                          {s.isPr && (
                            <span className="ml-1 text-amber-600 dark:text-amber-400 text-xs">PR</span>
                          )}
                          <span className="text-muted-foreground block text-xs">
                            Suggested {s.suggestedOneRmDisplay} {unitLabel}
                            {s.previousOneRmDisplay != null && ` · saved ${s.previousOneRmDisplay}`}
                          </span>
                        </span>
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="rounded-xl shrink-0"
                        disabled={done || saveOne.isPending || !isSel}
                        onClick={() =>
                          saveOne.mutate({
                            exerciseId: s.exerciseId,
                            oneRm: s.suggestedOneRmDisplay,
                          })
                        }
                      >
                        {done ? (
                          <>
                            <Check className="size-4 mr-1" /> Saved
                          </>
                        ) : saveOne.isPending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          "Save"
                        )}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-col gap-2 pt-2">
            <Button type="button" className="w-full rounded-xl h-12" onClick={onClose}>
              Done
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              <a href="/history" className="underline underline-offset-2 hover:text-foreground">
                View workout history
              </a>
            </p>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
