"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Replace, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NullableNumericInput, NumericInput } from "@/components/ui/numeric-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ExerciseSwapDialog } from "@/components/training/exercise-swap-dialog";
import { browserApiFetchInit } from "@/lib/browser-api-fetch";
import { cn } from "@/lib/utils";

type ProgramExerciseDetail = {
  id: string;
  sets: number;
  repTarget: number | null;
  targetRpe: number | null;
  pctOf1rm: number | null;
  restSec: number | null;
  useBodyweight: boolean | null;
  supersetGroup: string | null;
  notes: string | null;
  targetDurationSec: number | null;
  targetCalories: number | null;
  exercise: { slug: string; name: string; kind: "STRENGTH" | "CARDIO"; muscleTags?: string | null };
};

type ProgramDayDetail = {
  id: string;
  label: string;
  exercises: ProgramExerciseDetail[];
};

type ProgramDetailPayload = {
  program: {
    id: string;
    days: ProgramDayDetail[];
  };
  canEditStructure?: boolean;
};

type RowDraft = {
  sets: number;
  repTarget: number | null;
  targetRpe: number | null;
  pctOf1rm: number | null;
  restSec: number | null;
  supersetGroup: string | null;
  notes: string | null;
  targetDurationSec: number | null;
  targetCalories: number | null;
  useBodyweight: boolean | null;
};

export type DayProgramEditSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programId: string;
  programDayId: string;
  dayLabel: string;
  /** When the user has a workout open for this day, pass session id so swap can target session scope. */
  sessionId?: string | null;
  /** When true, hide add/remove/delete; prescription PATCH still allowed. */
  blockStructuralEdits?: boolean;
  structuralBlockReason?: string;
};

function emptyRowDraft(ex: ProgramExerciseDetail): RowDraft {
  return {
    sets: ex.sets,
    repTarget: ex.repTarget,
    targetRpe: ex.targetRpe,
    pctOf1rm: ex.pctOf1rm,
    restSec: ex.restSec,
    supersetGroup: ex.supersetGroup,
    notes: ex.notes,
    targetDurationSec: ex.targetDurationSec,
    targetCalories: ex.targetCalories,
    useBodyweight: ex.useBodyweight,
  };
}

export function DayProgramEditSheet({
  open,
  onOpenChange,
  programId,
  programDayId,
  dayLabel,
  sessionId = null,
  blockStructuralEdits = false,
  structuralBlockReason = "Cancel the in-progress workout for this day before adding or removing exercises.",
}: DayProgramEditSheetProps) {
  const qc = useQueryClient();
  const [draftById, setDraftById] = useState<Record<string, RowDraft>>({});
  const [swapTarget, setSwapTarget] = useState<ProgramExerciseDetail | null>(null);
  const [addSlug, setAddSlug] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const programQ = useQuery({
    queryKey: ["program", programId],
    queryFn: async () => {
      const r = await fetch(`/api/programs/${programId}`, browserApiFetchInit);
      if (r.status === 401) {
        window.location.assign("/login");
        throw new Error("Unauthorized");
      }
      if (!r.ok) throw new Error("Failed to load program");
      return r.json() as Promise<ProgramDetailPayload>;
    },
    enabled: open && Boolean(programId),
  });

  const day = useMemo(() => {
    const days = programQ.data?.program.days ?? [];
    return days.find((d) => d.id === programDayId) ?? null;
  }, [programQ.data?.program.days, programDayId]);

  const canEditSlots = programQ.data?.canEditStructure === true;
  const isTemplateReadonly = programQ.data != null && !canEditSlots;

  const exerciseSyncKey = useMemo(() => {
    if (!day?.exercises.length) return "";
    return day.exercises
      .map(
        (e) =>
          `${e.id}:${e.sets}:${e.repTarget}:${e.targetRpe}:${e.pctOf1rm}:${e.restSec}:${e.supersetGroup ?? ""}:${(e.notes ?? "").slice(0, 20)}:${e.targetDurationSec}:${e.targetCalories}:${e.useBodyweight}`,
      )
      .join("|");
  }, [day?.exercises]);

  useEffect(() => {
    if (!open || !day) return;
    const next: Record<string, RowDraft> = {};
    for (const ex of day.exercises) {
      next[ex.id] = emptyRowDraft(ex);
    }
    setDraftById(next);
  }, [open, programDayId, exerciseSyncKey]);

  const invalidateTraining = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["training-active"] });
    if (sessionId) void qc.invalidateQueries({ queryKey: ["session", sessionId] });
  }, [qc, sessionId]);

  const patchExercise = useMutation({
    mutationFn: async (args: { id: string; body: Record<string, unknown> }) => {
      const r = await fetch(`/api/program-exercises/${args.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args.body),
        ...browserApiFetchInit,
      });
      if (r.status === 401) {
        window.location.assign("/login");
        throw new Error("Unauthorized");
      }
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Update failed");
      return j;
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["program", programId] });
      invalidateTraining();
    },
  });

  const deleteExercise = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/program-exercises/${id}`, {
        method: "DELETE",
        ...browserApiFetchInit,
      });
      if (r.status === 401) {
        window.location.assign("/login");
        throw new Error("Unauthorized");
      }
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Remove failed");
      return j;
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["program", programId] });
      invalidateTraining();
    },
  });

  const addExercise = useMutation({
    mutationFn: async (exerciseSlug: string) => {
      const r = await fetch(`/api/program-days/${programDayId}/exercises`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseSlug,
          sets: 3,
          repTarget: 8,
          targetRpe: 8,
          pctOf1rm: null,
          restSec: 120,
        }),
        ...browserApiFetchInit,
      });
      if (r.status === 401) {
        window.location.assign("/login");
        throw new Error("Unauthorized");
      }
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Add failed");
      return j;
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["program", programId] });
      invalidateTraining();
    },
  });

  const exerciseHits = useQuery({
    queryKey: ["exercises", addSlug, "day-add"],
    queryFn: async () => {
      const r = await fetch(`/api/exercises?q=${encodeURIComponent(addSlug)}`, browserApiFetchInit);
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<{ id: string; name: string; slug: string; muscleTags: string }[]>;
    },
    enabled: open && addSlug.trim().length >= 1,
  });

  const saveRow = (ex: ProgramExerciseDetail) => {
    const d = draftById[ex.id];
    if (!d) return;
    const body: Record<string, unknown> = {};
    if (d.sets !== ex.sets) body.sets = d.sets;
    if (d.repTarget !== ex.repTarget) body.repTarget = d.repTarget;
    if (d.targetRpe !== ex.targetRpe) body.targetRpe = d.targetRpe;
    if (d.pctOf1rm !== ex.pctOf1rm) body.pctOf1rm = d.pctOf1rm;
    if (d.restSec !== ex.restSec) body.restSec = d.restSec;
    if ((d.supersetGroup ?? null) !== (ex.supersetGroup ?? null)) {
      body.supersetGroup = d.supersetGroup;
    }
    if ((d.notes ?? "").trim() !== (ex.notes ?? "").trim()) {
      body.notes = d.notes?.trim() ? d.notes.trim() : null;
    }
    if (d.targetDurationSec !== ex.targetDurationSec) body.targetDurationSec = d.targetDurationSec;
    if (d.targetCalories !== ex.targetCalories) body.targetCalories = d.targetCalories;
    if (d.useBodyweight !== ex.useBodyweight) body.useBodyweight = d.useBodyweight;
    if (Object.keys(body).length === 0) return;
    patchExercise.mutate({ id: ex.id, body });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        >
          <SheetHeader className="border-b px-4 py-4 text-left shrink-0">
            <SheetTitle className="flex items-center gap-2 pr-8">
              <Pencil className="size-5 shrink-0" />
              Edit day
            </SheetTitle>
            <SheetDescription className="text-pretty">
              {dayLabel} — adjust slots, then save each row. Swaps use your active program instance.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {programQ.isLoading && (
              <div className="flex justify-center py-12 text-muted-foreground">
                <Loader2 className="size-8 animate-spin" />
              </div>
            )}

            {programQ.isError && (
              <p className="text-destructive text-sm">{(programQ.error as Error).message}</p>
            )}

            {isTemplateReadonly && (
              <p className="text-sm text-muted-foreground leading-relaxed rounded-lg border bg-muted/40 px-3 py-2">
                This program cannot be edited here (system template).{" "}
                <Link href="/programs" className="font-medium text-primary underline-offset-4 hover:underline">
                  Duplicate it from Programs
                </Link>{" "}
                to customize days and exercises.
              </p>
            )}

            {blockStructuralEdits && (
              <p className="text-sm text-muted-foreground leading-relaxed rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                {structuralBlockReason}
              </p>
            )}

            {day && (
              <>
                <ul className="space-y-4">
                  {(day?.exercises ?? []).map((ex) => {
                    const d = draftById[ex.id] ?? emptyRowDraft(ex);
                    const cardio = ex.exercise.kind === "CARDIO";
                    const dirty =
                      d.sets !== ex.sets ||
                      d.repTarget !== ex.repTarget ||
                      d.targetRpe !== ex.targetRpe ||
                      d.pctOf1rm !== ex.pctOf1rm ||
                      d.restSec !== ex.restSec ||
                      (d.supersetGroup ?? null) !== (ex.supersetGroup ?? null) ||
                      (d.notes ?? "").trim() !== (ex.notes ?? "").trim() ||
                      d.targetDurationSec !== ex.targetDurationSec ||
                      d.targetCalories !== ex.targetCalories ||
                      d.useBodyweight !== ex.useBodyweight;
                    return (
                      <li
                        key={ex.id}
                        className="rounded-xl border bg-card p-3 space-y-3 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-sm leading-snug">{ex.exercise.name}</p>
                            <p className="text-muted-foreground text-xs mt-0.5">{ex.exercise.slug}</p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-9 rounded-lg text-muted-foreground"
                              title="Swap exercise"
                              onClick={() => setSwapTarget(ex)}
                            >
                              <Replace className="size-4" />
                            </Button>
                            {!blockStructuralEdits && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-9 rounded-lg text-muted-foreground hover:text-destructive"
                                title="Remove slot"
                                disabled={deleteExercise.isPending}
                                onClick={() => {
                                  if (
                                    !window.confirm(
                                      "Remove this exercise from the day template? This is only allowed when the slot has never been logged.",
                                    )
                                  ) {
                                    return;
                                  }
                                  deleteExercise.mutate(ex.id, {
                                    onError: (e) => window.alert((e as Error).message),
                                  });
                                }}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-xs">{cardio ? "Bouts" : "Sets"}</Label>
                            <NumericInput
                              className="rounded-lg"
                              value={d.sets}
                              onValueChange={(n) =>
                                setDraftById((s) => ({ ...s, [ex.id]: { ...d, sets: n } }))
                              }
                              min={1}
                              max={99}
                              fallback={d.sets}
                              disabled={!canEditSlots}
                            />
                          </div>
                          {!cardio && (
                            <>
                              <div className="space-y-1">
                                <Label className="text-xs">Rep target</Label>
                                <NumericInput
                                  className="rounded-lg"
                                  value={d.repTarget ?? 8}
                                  onValueChange={(n) =>
                                    setDraftById((s) => ({ ...s, [ex.id]: { ...d, repTarget: n } }))
                                  }
                                  min={1}
                                  max={999}
                                  fallback={d.repTarget ?? 8}
                                  disabled={!canEditSlots}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Target RPE</Label>
                                <NumericInput
                                  decimals
                                  snapHalf
                                  className="rounded-lg"
                                  value={d.targetRpe ?? 8}
                                  onValueChange={(n) =>
                                    setDraftById((s) => ({ ...s, [ex.id]: { ...d, targetRpe: n } }))
                                  }
                                  min={6}
                                  max={10}
                                  fallback={d.targetRpe ?? 8}
                                  disabled={!canEditSlots}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">%1RM</Label>
                                <NullableNumericInput
                                  className="rounded-lg"
                                  placeholder="—"
                                  value={d.pctOf1rm ?? null}
                                  onValueChange={(n) =>
                                    setDraftById((s) => ({ ...s, [ex.id]: { ...d, pctOf1rm: n } }))
                                  }
                                  min={0}
                                  max={100}
                                  disabled={!canEditSlots}
                                />
                              </div>
                            </>
                          )}
                          <div className="space-y-1">
                            <Label className="text-xs">Superset</Label>
                            <Select
                              value={d.supersetGroup ?? "none"}
                              onValueChange={(v) =>
                                setDraftById((s) => ({
                                  ...s,
                                  [ex.id]: { ...d, supersetGroup: v === "none" ? null : v },
                                }))
                              }
                              disabled={!canEditSlots}
                            >
                              <SelectTrigger className="rounded-lg">
                                <SelectValue placeholder="None" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="A">A</SelectItem>
                                <SelectItem value="B">B</SelectItem>
                                <SelectItem value="C">C</SelectItem>
                                <SelectItem value="D">D</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Rest (s)</Label>
                            <NullableNumericInput
                              className="rounded-lg"
                              value={d.restSec ?? null}
                              onValueChange={(n) =>
                                setDraftById((s) => ({ ...s, [ex.id]: { ...d, restSec: n } }))
                              }
                              min={15}
                              max={3600}
                              disabled={!canEditSlots}
                            />
                          </div>
                          {!cardio && (
                            <div className="space-y-1 sm:col-span-2">
                              <Label className="text-xs">Bodyweight</Label>
                              <Select
                                value={
                                  d.useBodyweight === null || d.useBodyweight === undefined
                                    ? "inherit"
                                    : d.useBodyweight
                                      ? "yes"
                                      : "no"
                                }
                                onValueChange={(v) =>
                                  setDraftById((s) => ({
                                    ...s,
                                    [ex.id]: {
                                      ...d,
                                      useBodyweight: v === "inherit" ? null : v === "yes",
                                    },
                                  }))
                                }
                                disabled={!canEditSlots}
                              >
                                <SelectTrigger className="rounded-lg">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="inherit">Use library default</SelectItem>
                                  <SelectItem value="yes">Yes (BW)</SelectItem>
                                  <SelectItem value="no">No (load)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          {cardio && (
                            <>
                              <div className="space-y-1">
                                <Label className="text-xs">Target time (s)</Label>
                                <NullableNumericInput
                                  className="rounded-lg"
                                  value={d.targetDurationSec ?? null}
                                  onValueChange={(n) =>
                                    setDraftById((s) => ({
                                      ...s,
                                      [ex.id]: { ...d, targetDurationSec: n },
                                    }))
                                  }
                                  min={0}
                                  max={86400}
                                  disabled={!canEditSlots}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Target kcal</Label>
                                <NullableNumericInput
                                  className="rounded-lg"
                                  value={d.targetCalories ?? null}
                                  onValueChange={(n) =>
                                    setDraftById((s) => ({
                                      ...s,
                                      [ex.id]: { ...d, targetCalories: n },
                                    }))
                                  }
                                  min={0}
                                  max={50000}
                                  disabled={!canEditSlots}
                                />
                              </div>
                            </>
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Slot notes</Label>
                          <textarea
                            className={cn(
                              "flex min-h-[64px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
                              "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                              "disabled:cursor-not-allowed disabled:opacity-50",
                            )}
                            value={d.notes ?? ""}
                            onChange={(e) =>
                              setDraftById((s) => ({
                                ...s,
                                [ex.id]: { ...d, notes: e.target.value || null },
                              }))
                            }
                            disabled={!canEditSlots}
                            placeholder="Coaching cues…"
                          />
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          className="w-full rounded-lg"
                          variant="secondary"
                          disabled={!canEditSlots || !dirty || patchExercise.isPending}
                          onClick={() => saveRow(ex)}
                        >
                          {patchExercise.isPending ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            "Save row"
                          )}
                        </Button>
                      </li>
                    );
                  })}
                </ul>

                {!blockStructuralEdits && (
                  <div className="rounded-xl border border-dashed p-3 space-y-2">
                    <Label className="text-xs text-muted-foreground">Add exercise</Label>
                    <Input
                      className="rounded-lg"
                      placeholder="Search catalog…"
                      value={addSlug}
                      onChange={(e) => {
                        setAddSlug(e.target.value);
                        setAddError(null);
                      }}
                    />
                    {addSlug.trim().length > 0 && (
                      <ul className="max-h-40 overflow-y-auto rounded-lg border bg-popover text-sm">
                        {(exerciseHits.data ?? []).map((hit) => (
                          <li key={hit.id}>
                            <button
                              type="button"
                              className="w-full text-left px-3 py-2 hover:bg-muted/80"
                              onClick={() => {
                                addExercise.mutate(hit.slug, {
                                  onSuccess: () => {
                                    setAddSlug("");
                                    setAddError(null);
                                  },
                                  onError: (e) => setAddError((e as Error).message),
                                });
                              }}
                            >
                              {hit.name}
                            </button>
                          </li>
                        ))}
                        {exerciseHits.isLoading && (
                          <li className="flex justify-center py-3 text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" />
                          </li>
                        )}
                        {!exerciseHits.isLoading && (exerciseHits.data?.length ?? 0) === 0 && (
                          <li className="px-3 py-2 text-muted-foreground">No matches</li>
                        )}
                      </ul>
                    )}
                    {addError && <p className="text-destructive text-xs">{addError}</p>}
                    <p className="text-muted-foreground text-xs">
                      <Plus className="size-3 inline mr-1 align-middle" />
                      Pick a lift from search to append to this day (defaults: 3×8 @ 8 RPE, 120s rest).
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ExerciseSwapDialog
        open={swapTarget != null}
        onOpenChange={(o) => {
          if (!o) setSwapTarget(null);
        }}
        programExerciseId={swapTarget?.id ?? ""}
        currentExerciseName={swapTarget?.exercise.name ?? ""}
        currentExerciseMuscleTags={swapTarget?.exercise.muscleTags ?? undefined}
        sessionId={sessionId}
        onSuccess={() => {
          void qc.invalidateQueries({ queryKey: ["program", programId] });
          invalidateTraining();
        }}
      />
    </>
  );
}
