"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Check, ChevronDown, Loader2, Replace, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useWorkoutSessionStore } from "@/stores/workout-session-store";
import { RestTimerRing } from "@/components/training/rest-timer";
import { ExerciseLibrarySheet } from "@/components/training/exercise-library-sheet";
import { ExerciseSwapDialog } from "@/components/training/exercise-swap-dialog";
import {
  SessionCompleteSplash,
  type SessionCompleteSummaryPayload,
} from "@/components/training/session-complete-splash";
import { resolvePlateIncrementForSession, suggestNextWeekLoad, type WeightUnit } from "@/lib/calculators";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  clusterSupersetBlocks,
  flattenBlockOrder,
  orderExercises,
  parseExerciseOrderJson,
} from "@/lib/workout-blocks";
import { restSecForRpe } from "@/lib/rest-by-rpe";
import { SortableWorkoutBlock } from "@/components/training/sortable-workout-block";

type LoggedSetRow = {
  id: string;
  programExerciseId: string;
  setIndex: number;
  weight: number;
  weightUnit: string;
  reps: number | null;
  rpe: number | null;
  done: boolean;
};

type ProgramExerciseRow = {
  id: string;
  sortOrder: number;
  supersetGroup: string | null;
  sets: number;
  repTarget: number;
  targetRpe: number;
  pctOf1rm: number | null;
  restSec: number | null;
  exercise: {
    id: string;
    name: string;
    slug: string;
    barIncrementLb: number | null;
    effectiveBarIncrementLb?: number | null;
    muscleTags?: string;
  };
};

type SessionPayload = {
  session: {
    id: string;
    status: string;
    sleep: number | null;
    stress: number | null;
    soreness: number | null;
    intensityMultiplier: number;
    weekIndex: number;
    performedAt?: string;
    exerciseOrder?: unknown;
    sets: LoggedSetRow[];
    programDay: {
      label: string;
      exercises: ProgramExerciseRow[];
    };
  };
  settings: {
    defaultRestSec: number;
    preferredWeightUnit: "KG" | "LB";
    plateIncrementLb: number;
    plateIncrementKg: number;
    restDurationsByRpe: Record<string, number>;
  } | null;
  previousByExerciseId: Record<
    string,
    { weight: number; weightUnit: string; reps: number | null; rpe: number | null }[]
  >;
  displayUnit: "KG" | "LB";
};

function toDatetimeLocalValue(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function WorkoutSessionView({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const openLibrary = useWorkoutSessionStore((s) => s.openLibrary);
  const startRest = useWorkoutSessionStore((s) => s.startRest);
  const clearRest = useWorkoutSessionStore((s) => s.clearRest);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [swapTarget, setSwapTarget] = useState<{
    programExerciseId: string;
    name: string;
    muscleTags?: string;
  } | null>(null);
  const [completeSplash, setCompleteSplash] = useState<SessionCompleteSummaryPayload | null>(null);
  const [collapsedBlockIds, setCollapsedBlockIds] = useState<Set<string>>(() => new Set());
  const toggleBlockCollapsed = useCallback((blockId: string) => {
    setCollapsedBlockIds((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  }, []);

  const q = useQuery({
    queryKey: ["session", sessionId],
    queryFn: async () => {
      const r = await fetch(`/api/training/sessions/${sessionId}`, { credentials: "include" });
      if (r.status === 401) {
        window.location.assign("/login");
        throw new Error("Unauthorized");
      }
      if (r.status === 404) {
        throw new Error("SESSION_NOT_FOUND");
      }
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<SessionPayload>;
    },
  });

  useEffect(() => {
    if (!q.data?.settings) return;
    useWorkoutSessionStore.setState({ restDurationSec: q.data.settings.defaultRestSec });
  }, [q.data?.settings]);

  useEffect(() => {
    if (completeSplash) clearRest();
  }, [completeSplash, clearRest]);

  const patch = useMutation({
    mutationFn: async (body: object) => {
      const r = await fetch(`/api/training/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (r.status === 401) {
        window.location.assign("/login");
        throw new Error("Unauthorized");
      }
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Update failed");
      }
      return (await r.json()) as unknown;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["session", sessionId] });
      void qc.invalidateQueries({ queryKey: ["training-history"] });
    },
  });

  const del = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/training/sessions/${sessionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (r.status === 401) {
        window.location.assign("/login");
        throw new Error("Unauthorized");
      }
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Delete failed");
      }
      return r.json();
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["training-history"] });
      void qc.invalidateQueries({ queryKey: ["training-active"] });
      router.push("/history");
    },
  });

  const byExercise = useMemo(() => {
    const session = q.data?.session;
    if (!session) return new Map<string, LoggedSetRow[]>();
    const ordered = orderExercises(
      session.programDay.exercises,
      parseExerciseOrderJson(session.exerciseOrder),
    );
    const pos = new Map(ordered.map((e, i) => [e.id, i]));
    const rows = [...session.sets].sort((a, b) => {
      const ao = pos.get(a.programExerciseId) ?? 0;
      const bo = pos.get(b.programExerciseId) ?? 0;
      if (ao !== bo) return ao - bo;
      return a.setIndex - b.setIndex;
    });
    const m = new Map<string, LoggedSetRow[]>();
    for (const s of rows) {
      if (!m.has(s.programExerciseId)) m.set(s.programExerciseId, []);
      m.get(s.programExerciseId)!.push(s);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.setIndex - b.setIndex);
    return m;
  }, [q.data?.session]);
  const sessionEarly = q.data?.session;
  const [performedAtLocal, setPerformedAtLocal] = useState("");
  useEffect(() => {
    if (sessionEarly?.performedAt) {
      setPerformedAtLocal(toDatetimeLocalValue(sessionEarly.performedAt));
    }
  }, [sessionEarly?.performedAt]);

  const orderedExercises = useMemo(() => {
    if (!sessionEarly) return [] as ProgramExerciseRow[];
    return orderExercises(
      sessionEarly.programDay.exercises,
      parseExerciseOrderJson(sessionEarly.exerciseOrder),
    );
  }, [sessionEarly]);

  const blocks = useMemo(() => clusterSupersetBlocks(orderedExercises), [orderedExercises]);
  const blockIds = useMemo(() => blocks.map((b) => b.map((e) => e.id).join("|")), [blocks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const commitSet = useCallback(
    async (body: object) => {
      await patch.mutateAsync(body);
      const st = qc.getQueryData<SessionPayload>(["session", sessionId])?.session.status;
      if (st === "COMPLETED") return;
      const b = body as { action?: string; setId?: string; done?: boolean };
      if (b.action !== "set" || b.done !== true) return;
      await qc.refetchQueries({ queryKey: ["session", sessionId] });
      const payload = qc.getQueryData<SessionPayload>(["session", sessionId]);
      if (!payload || !payload.settings) return;
      const sessSettings = payload.settings;
      const row = payload.session.sets.find((s) => s.id === b.setId);
      if (!row) return;
      const setIndex = row.setIndex;
      const ordered = orderExercises(
        payload.session.programDay.exercises,
        parseExerciseOrderJson(payload.session.exerciseOrder),
      );
      const blks = clusterSupersetBlocks(ordered);
      const block = blks.find((blk) => blk.some((e) => e.id === row.programExerciseId));
      if (!block) return;
      const defaultRest = sessSettings.defaultRestSec ?? 120;
      const rpeMap = sessSettings.restDurationsByRpe ?? {};
      const hasPrescribedRest = block.some((ex) => ex.restSec != null);
      const restSec = hasPrescribedRest
        ? Math.max(
            ...block.map((ex) => ex.restSec ?? defaultRest),
            0,
          )
        : Math.max(
            ...block.map((ex) => {
              const rs = payload.session.sets
                .filter((s) => s.programExerciseId === ex.id)
                .sort((a, b) => a.setIndex - b.setIndex);
              const setRow = rs[setIndex];
              const rpeForRest = setRow?.rpe ?? ex.targetRpe;
              return restSecForRpe(rpeMap, rpeForRest, defaultRest);
            }),
            0,
          );
      const allDone = block.every((ex) => {
        const rs = payload.session.sets
          .filter((s) => s.programExerciseId === ex.id)
          .sort((a, b) => a.setIndex - b.setIndex);
        return rs[setIndex]?.done === true;
      });
      if (allDone) startRest(restSec);
    },
    [patch, qc, sessionId, startRest],
  );

  const onDragEndBlocks = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const ids = blockIds;
      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;
      const next = arrayMove(blocks, oldIndex, newIndex);
      const flat = flattenBlockOrder(next);
      await patch.mutateAsync({ action: "reorderExercises", orderedProgramExerciseIds: flat });
    },
    [blockIds, blocks, patch],
  );


  if (q.isLoading || (!q.data && !q.isError)) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (q.isError) {
    if (q.error instanceof Error && q.error.message === "SESSION_NOT_FOUND") {
      return (
        <Card className="mx-auto max-w-md rounded-2xl border">
          <CardHeader>
            <CardTitle className="text-lg">Workout unavailable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              This session was cancelled or removed. Open Train or History to continue.
            </p>
            <div className="flex flex-col gap-2">
              <Link
                href="/history"
                className={cn(
                  buttonVariants({ size: "lg", variant: "default" }),
                  "h-12 w-full rounded-xl inline-flex items-center justify-center",
                )}
              >
                Workout history
              </Link>
              <Link
                href="/"
                className={cn(
                  buttonVariants({ size: "lg", variant: "outline" }),
                  "h-12 w-full rounded-xl inline-flex items-center justify-center",
                )}
              >
                Back to Train
              </Link>
            </div>
          </CardContent>
        </Card>
      );
    }
    return (
      <p className="text-center text-sm text-destructive py-12">
        Could not load this workout.{" "}
        <Link href="/" className="underline underline-offset-4">
          Back to Train
        </Link>
      </p>
    );
  }

  if (!q.data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { session, settings, previousByExerciseId } = q.data;
  const unit = settings?.preferredWeightUnit ?? "LB";
  const isHistorySession = session.status === "COMPLETED";
  const readinessNeeded =
    session.sleep == null && (session.status === "PLANNED" || session.status === "IN_PROGRESS");
  const canCancel = session.status === "PLANNED" || session.status === "IN_PROGRESS";

  return (
    <div className="space-y-6 pb-28">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{session.programDay.label}</h1>
            {isHistorySession && (
              <Badge variant="secondary" className="text-xs">
                Completed
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            Week {session.weekIndex + 1}
            {session.intensityMultiplier !== 1 && (
              <span>
                {" "}
                · intensity ×{session.intensityMultiplier.toFixed(2)}
              </span>
            )}
          </p>
          {isHistorySession && (
            <Link href="/history" className="text-xs text-primary underline-offset-4 hover:underline mt-1 inline-block">
              ← All workouts
            </Link>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl shrink-0"
          onClick={() => openLibrary("__all__")}
        >
          <BookOpen className="size-4" />
          Library
        </Button>
      </div>

      {readinessNeeded && (
        <ReadinessCard
          onSubmit={(sleep, stress, soreness) =>
            patch.mutate({ action: "readiness", sleep, stress, soreness })
          }
          loading={patch.isPending}
        />
      )}

      {!readinessNeeded &&
        (() => {
          const canReorderBlocks = canCancel && blocks.length > 1;

          const blockSetProgress = (block: ProgramExerciseRow[]) => {
            let done = 0;
            let total = 0;
            for (const ex of block) {
              const rows = byExercise.get(ex.id) ?? [];
              total += rows.length;
              for (const r of rows) {
                if (r.done) done += 1;
              }
            }
            return { done, total };
          };

          const renderExerciseHeader = (ex: ProgramExerciseRow) => (
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg">{ex.exercise.name}</CardTitle>
              <div className="flex items-center gap-1 shrink-0">
                {canCancel && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground min-h-11 px-2 sm:px-3"
                    onClick={() =>
                    setSwapTarget({
                      programExerciseId: ex.id,
                      name: ex.exercise.name,
                      muscleTags: ex.exercise.muscleTags,
                    })
                  }
                    type="button"
                  >
                    <Replace className="size-4 sm:mr-1" />
                    <span className="hidden sm:inline">Swap</span>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground min-h-11 min-w-11 shrink-0 px-3 sm:min-w-0"
                  onClick={() => openLibrary(ex.exercise.slug)}
                >
                  History
                </Button>
              </div>
            </div>
          );

          const renderSoloCard = (ex: ProgramExerciseRow, blockId: string) => {
            const collapsed = collapsedBlockIds.has(blockId);
            const rows = byExercise.get(ex.id) ?? [];
            const prev = previousByExerciseId[ex.id];
            const { done, total } = blockSetProgress([ex]);
            const plateInc = resolvePlateIncrementForSession(
              unit as WeightUnit,
              ex.exercise.effectiveBarIncrementLb ?? ex.exercise.barIncrementLb,
              {
                plateIncrementLb: settings?.plateIncrementLb ?? 2.5,
                plateIncrementKg: settings?.plateIncrementKg ?? 2.5,
              },
            );
            return (
              <Card className="overflow-hidden rounded-2xl border shadow-sm">
                <CardHeader className="bg-muted/40 space-y-1">
                  <div className="flex items-start gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 size-9 rounded-lg mt-0.5"
                      onClick={() => toggleBlockCollapsed(blockId)}
                      aria-expanded={!collapsed}
                      aria-label={collapsed ? "Expand exercise" : "Collapse exercise"}
                    >
                      <ChevronDown
                        className={cn(
                          "size-5 text-muted-foreground transition-transform",
                          collapsed && "-rotate-90",
                        )}
                      />
                    </Button>
                    <div className="flex-1 min-w-0 space-y-1">
                      {renderExerciseHeader(ex)}
                      {collapsed ? (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {done}/{total} sets done
                          </span>
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <Badge variant="secondary">{ex.sets} sets</Badge>
                          <Badge variant="outline">
                            Target {ex.repTarget} reps @ ~{ex.targetRpe} RPE
                          </Badge>
                          {ex.pctOf1rm != null && <Badge variant="outline">{ex.pctOf1rm}% 1RM</Badge>}
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                {!collapsed && (
                  <CardContent className="space-y-4 pt-4">
                    {rows.map((row, idx) => {
                      const ghost = prev?.[idx];
                      const prog = suggestNextWeekLoad({
                        currentWeight: row.weight,
                        repGoal: ex.repTarget,
                        actualReps: row.reps ?? 0,
                        prescribedRpe: ex.targetRpe,
                        actualRpe: row.rpe ?? ex.targetRpe,
                        plateIncrement: plateInc,
                      });
                      return (
                        <SetRowEditor
                          key={row.id}
                          row={row}
                          idx={idx}
                          unit={unit}
                          repTarget={ex.repTarget}
                          targetRpe={ex.targetRpe}
                          ghost={ghost}
                          prog={prog}
                          progressionStep={plateInc}
                          onCommitSet={(body) => void commitSet(body)}
                        />
                      );
                    })}
                    <Separator />
                  </CardContent>
                )}
              </Card>
            );
          };

          const renderSupersetCard = (block: ProgramExerciseRow[], blockId: string) => {
            const label = block[0]?.supersetGroup ?? "Superset";
            const nSets = block[0]!.sets;
            const collapsed = collapsedBlockIds.has(blockId);
            const { done, total } = blockSetProgress(block);
            const names = block.map((e) => e.exercise.name).join(" · ");
            return (
              <Card className="overflow-hidden rounded-2xl border shadow-sm border-primary/25">
                <CardHeader className="bg-primary/5 space-y-1">
                  <div className="flex items-start gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 size-9 rounded-lg mt-0.5"
                      onClick={() => toggleBlockCollapsed(blockId)}
                      aria-expanded={!collapsed}
                      aria-label={collapsed ? "Expand superset" : "Collapse superset"}
                    >
                      <ChevronDown
                        className={cn(
                          "size-5 text-muted-foreground transition-transform",
                          collapsed && "-rotate-90",
                        )}
                      />
                    </Button>
                    <div className="flex-1 min-w-0 space-y-1">
                      <CardTitle className="text-lg">Superset ({label})</CardTitle>
                      {collapsed ? (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {done}/{total} sets done
                          </span>
                          <span> · {names}</span>
                        </p>
                      ) : (
                        <>
                          <p className="text-muted-foreground text-xs">
                            Alternate exercises each round, then rest when the full round is done.
                          </p>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <Badge variant="secondary">{nSets} rounds</Badge>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                {!collapsed && (
                  <CardContent className="space-y-6 pt-4">
                    {Array.from({ length: nSets }, (_, si) => (
                      <div key={si} className="space-y-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Round {si + 1}
                        </p>
                        {block.map((ex) => {
                          const rows = byExercise.get(ex.id) ?? [];
                          const row = rows[si];
                          const prev = previousByExerciseId[ex.id];
                          const ghost = prev?.[si];
                          const plateInc = resolvePlateIncrementForSession(
                            unit as WeightUnit,
                            ex.exercise.effectiveBarIncrementLb ?? ex.exercise.barIncrementLb,
                            {
                              plateIncrementLb: settings?.plateIncrementLb ?? 2.5,
                              plateIncrementKg: settings?.plateIncrementKg ?? 2.5,
                            },
                          );
                          if (!row) return null;
                          const prog = suggestNextWeekLoad({
                            currentWeight: row.weight,
                            repGoal: ex.repTarget,
                            actualReps: row.reps ?? 0,
                            prescribedRpe: ex.targetRpe,
                            actualRpe: row.rpe ?? ex.targetRpe,
                            plateIncrement: plateInc,
                          });
                          return (
                            <div key={ex.id} className="rounded-xl border bg-muted/20 p-3 space-y-2">
                              {renderExerciseHeader(ex)}
                              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline">
                                  Target {ex.repTarget} reps @ ~{ex.targetRpe} RPE
                                </Badge>
                                {ex.pctOf1rm != null && (
                                  <Badge variant="outline">{ex.pctOf1rm}% 1RM</Badge>
                                )}
                              </div>
                              <SetRowEditor
                                row={row}
                                idx={si}
                                unit={unit}
                                repTarget={ex.repTarget}
                                targetRpe={ex.targetRpe}
                                ghost={ghost}
                                prog={prog}
                                progressionStep={plateInc}
                                onCommitSet={(body) => void commitSet(body)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    <Separator />
                  </CardContent>
                )}
              </Card>
            );
          };

          const items = blocks.map((block, bi) => {
            const id = blockIds[bi]!;
            const isSuperset = block.length > 1;
            const card = isSuperset ? renderSupersetCard(block, id) : renderSoloCard(block[0]!, id);
            if (!canReorderBlocks) {
              return <div key={id}>{card}</div>;
            }
            return (
              <SortableWorkoutBlock key={id} id={id}>
                {(handle) => (
                  <div className="flex gap-2 items-start">
                    <div className="pt-3 shrink-0">{handle}</div>
                    <div className="flex-1 min-w-0">{card}</div>
                  </div>
                )}
              </SortableWorkoutBlock>
            );
          });

          if (canReorderBlocks) {
            return (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => void onDragEndBlocks(e)}
              >
                <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
                  <div className="space-y-4">{items}</div>
                </SortableContext>
              </DndContext>
            );
          }
          return <div className="space-y-4">{items}</div>;
        })()}

      {isHistorySession && (
        <Card className="rounded-2xl border">
          <CardHeader className="py-3">
            <CardTitle className="text-base">Workout date</CardTitle>
            <p className="text-muted-foreground text-xs">Adjust when you trained (saved automatically on change).</p>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label className="text-xs">Performed at</Label>
            <Input
              type="datetime-local"
              className="rounded-xl max-w-xs"
              value={performedAtLocal}
              onChange={(e) => setPerformedAtLocal(e.target.value)}
              onBlur={() => {
                if (!performedAtLocal) return;
                const d = new Date(performedAtLocal);
                if (Number.isNaN(d.getTime())) return;
                patch.mutate({ action: "updateMetadata", performedAt: d.toISOString() });
              }}
              disabled={patch.isPending}
            />
          </CardContent>
        </Card>
      )}

      {isHistorySession && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
          <p className="text-muted-foreground text-sm">
            Delete removes this workout from history and charts. Your program&apos;s current week and next
            training day stay as they are.
          </p>
          <Button
            type="button"
            variant="destructive"
            className="h-12 w-full rounded-xl gap-2"
            onClick={() => setDeleteOpen(true)}
            disabled={del.isPending || patch.isPending}
          >
            <Trash2 className="size-4" />
            Delete workout
          </Button>
        </div>
      )}

      {canCancel && (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setCancelOpen(true)}
            disabled={patch.isPending}
          >
            Cancel session
          </Button>
          {!readinessNeeded && (
            <Button
              className="h-12 w-full rounded-xl"
              onClick={async () => {
                try {
                  const res = (await patch.mutateAsync({ action: "complete" })) as {
                    summary?: SessionCompleteSummaryPayload;
                  };
                  void qc.invalidateQueries({ queryKey: ["training-active"] });
                  void qc.invalidateQueries({ queryKey: ["training-history"] });
                  if (res.summary) setCompleteSplash(res.summary);
                  else router.push("/");
                } catch {
                  /* PATCH error surfaced via mutation state */
                }
              }}
              disabled={patch.isPending}
            >
              Complete session
            </Button>
          )}
        </div>
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="rounded-2xl" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete this workout?</DialogTitle>
            <DialogDescription>
              This cannot be undone. Logged sets and readiness for this session will be removed. Your active
              program position does not change.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              variant="destructive"
              className="w-full rounded-xl"
              disabled={del.isPending}
              onClick={() => del.mutate()}
            >
              {del.isPending ? <Loader2 className="size-4 animate-spin" /> : "Yes, delete"}
            </Button>
            <Button variant="outline" className="w-full rounded-xl" type="button" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
          {del.isError && (
            <p className="text-destructive text-sm">{(del.error as Error).message}</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="rounded-2xl" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Cancel this workout?</DialogTitle>
            <DialogDescription>
              Nothing will count as completed. You can start this day again from Train. Your week does not advance.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              variant="destructive"
              className="w-full rounded-xl"
              disabled={patch.isPending}
              onClick={() => {
                patch.mutate(
                  { action: "cancel" },
                  {
                    onSuccess: () => {
                      setCancelOpen(false);
                      qc.invalidateQueries({ queryKey: ["training-active"] });
                      qc.invalidateQueries({ queryKey: ["session", sessionId] });
                      window.location.href = "/";
                    },
                  },
                );
              }}
            >
              {patch.isPending ? <Loader2 className="size-4 animate-spin" /> : "Yes, cancel session"}
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-xl"
              type="button"
              onClick={() => setCancelOpen(false)}
            >
              Keep going
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!isHistorySession && <RestTimerRing />}
      <ExerciseLibrarySheet />
      <ExerciseSwapDialog
        open={swapTarget != null}
        onOpenChange={(o) => {
          if (!o) setSwapTarget(null);
        }}
        programExerciseId={swapTarget?.programExerciseId ?? ""}
        currentExerciseName={swapTarget?.name ?? ""}
        currentExerciseMuscleTags={swapTarget?.muscleTags}
        sessionId={sessionId}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["session", sessionId] })}
      />
      {completeSplash && (
        <SessionCompleteSplash
          open
          summary={completeSplash}
          sessionId={sessionId}
          onClose={() => {
            setCompleteSplash(null);
            void qc.invalidateQueries({ queryKey: ["session", sessionId] });
            router.push("/");
          }}
        />
      )}
    </div>
  );
}

function SetRowEditor({
  row,
  idx,
  unit,
  repTarget,
  targetRpe,
  ghost,
  prog,
  progressionStep,
  onCommitSet,
}: {
  row: LoggedSetRow;
  idx: number;
  unit: "KG" | "LB";
  repTarget: number;
  targetRpe: number;
  ghost?: { weight: number; weightUnit: string; reps: number | null; rpe: number | null };
  prog: ReturnType<typeof suggestNextWeekLoad>;
  progressionStep: number;
  onCommitSet: (body: object) => void;
}) {
  const [local, setLocal] = useState({
    weight: String(row.weight || ""),
    reps: row.reps != null ? String(row.reps) : String(repTarget),
    rpe: row.rpe != null ? String(row.rpe) : String(targetRpe),
  });

  useEffect(() => {
    setLocal({
      weight: String(row.weight || ""),
      reps: row.reps != null ? String(row.reps) : String(repTarget),
      rpe: row.rpe != null ? String(row.rpe) : String(targetRpe),
    });
  }, [row.weight, row.reps, row.rpe, repTarget, targetRpe]);

  return (
    <div className="rounded-xl border bg-card/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Set {idx + 1}</span>
        <Toggle
          pressed={row.done}
          onPressedChange={(nextDone) => {
            if (nextDone) {
              onCommitSet({
                action: "set",
                setId: row.id,
                weight: Number(local.weight) || 0,
                weightUnit: unit,
                reps: local.reps === "" ? null : Number(local.reps),
                rpe: local.rpe === "" ? null : Number(local.rpe),
                done: true,
              });
            } else {
              onCommitSet({ action: "set", setId: row.id, done: false });
            }
          }}
          className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          <Check className="size-4" />
          Done
        </Toggle>
      </div>
      {ghost && (
        <p className="text-muted-foreground text-xs">
          Last time:{" "}
          <span className="font-medium text-foreground">
            {ghost.weight}
            {ghost.weightUnit} × {ghost.reps}
            {ghost.rpe != null ? ` @ ${ghost.rpe} RPE` : ""}
          </span>
        </p>
      )}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Weight ({unit})</Label>
          <Input
            type="number"
            className="rounded-lg"
            value={local.weight}
            placeholder={ghost ? `${ghost.weight}` : "0"}
            onChange={(e) => setLocal((l) => ({ ...l, weight: e.target.value }))}
            onBlur={() =>
              onCommitSet({
                action: "set",
                setId: row.id,
                weight: Number(local.weight) || 0,
                weightUnit: unit,
              })
            }
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Reps</Label>
          <Input
            type="number"
            className="rounded-lg"
            value={local.reps}
            onChange={(e) => setLocal((l) => ({ ...l, reps: e.target.value }))}
            onBlur={() =>
              onCommitSet({
                action: "set",
                setId: row.id,
                reps: local.reps === "" ? null : Number(local.reps),
              })
            }
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">RPE</Label>
          <Input
            type="number"
            step="0.5"
            className="rounded-lg"
            value={local.rpe}
            onChange={(e) => setLocal((l) => ({ ...l, rpe: e.target.value }))}
            onBlur={() =>
              onCommitSet({
                action: "set",
                setId: row.id,
                rpe: local.rpe === "" ? null : Number(local.rpe),
              })
            }
          />
        </div>
      </div>
      {prog.bumped && row.done && (
        <p className="text-xs text-muted-foreground">
          Next week idea: ~{prog.suggested.toFixed(1)} {unit} (+{(prog.bumpPct * 100).toFixed(1)}%), nearest{" "}
          {progressionStep % 1 === 0 ? progressionStep.toFixed(0) : progressionStep.toFixed(1)} {unit} step
        </p>
      )}
    </div>
  );
}

function ReadinessCard({
  onSubmit,
  loading,
}: {
  onSubmit: (sleep: number, stress: number, soreness: number) => void;
  loading: boolean;
}) {
  const [sleep, setSleep] = useState(7);
  const [stress, setStress] = useState(3);
  const [soreness, setSoreness] = useState(3);

  return (
    <Card className="rounded-2xl border-primary/30">
      <CardHeader>
        <CardTitle className="text-lg">Readiness</CardTitle>
        <p className="text-muted-foreground text-sm">
          Sleep quality (higher is better), stress and soreness (lower is usually better).
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Sleep</span>
            <span>{sleep}</span>
          </div>
          <Slider
            value={[sleep]}
            min={0}
            max={10}
            step={1}
            onValueChange={(v) => setSleep(Array.isArray(v) ? (v[0] ?? 0) : v)}
          />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Stress</span>
            <span>{stress}</span>
          </div>
          <Slider
            value={[stress]}
            min={0}
            max={10}
            step={1}
            onValueChange={(v) => setStress(Array.isArray(v) ? (v[0] ?? 0) : v)}
          />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Soreness</span>
            <span>{soreness}</span>
          </div>
          <Slider
            value={[soreness]}
            min={0}
            max={10}
            step={1}
            onValueChange={(v) => setSoreness(Array.isArray(v) ? (v[0] ?? 0) : v)}
          />
        </div>
        <Button className="w-full rounded-xl" disabled={loading} onClick={() => onSubmit(sleep, stress, soreness)}>
          {loading ? <Loader2 className="animate-spin" /> : "Apply to session"}
        </Button>
      </CardContent>
    </Card>
  );
}
