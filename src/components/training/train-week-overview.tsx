"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { format } from "date-fns";
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
import { ChevronDown, Loader2, Play, Replace } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExerciseSwapDialog } from "@/components/training/exercise-swap-dialog";
import { SortableWorkoutBlock } from "@/components/training/sortable-workout-block";
import { cn } from "@/lib/utils";
import { browserApiFetchInit } from "@/lib/browser-api-fetch";

export type ScheduleDay = {
  id: string;
  label: string;
  sortOrder: number;
  exercises: {
    id: string;
    sets: number;
    repTarget: number;
    targetRpe: number;
    pctOf1rm: number | null;
    exercise: { id: string; name: string; slug: string; muscleTags?: string };
  }[];
};

type LastCompleted = {
  sessionId: string;
  weekIndex: number;
  performedAt: string;
  dayLabel: string;
  daySortOrder: number;
  programDayId: string;
} | null;

type TrainingActiveCache = {
  instance: {
    id: string;
    weekIndex: number;
    nextDaySortOrder: number;
    programId: string;
    program: { name: string; durationWeeks: number; days: ScheduleDay[] };
  } | null;
  nextDay: { id: string; label: string } | null;
  inProgressSession: { id: string; programDayId: string } | null;
  lastCompleted: LastCompleted;
  completedDayIdsThisWeek: string[];
};

type Props = {
  durationWeeks: number;
  weekIndex: number;
  nextDaySortOrder: number;
  days: ScheduleDay[];
  completedDayIdsThisWeek: string[];
  inProgressSession: { id: string; programDayId: string } | null;
  lastCompleted: LastCompleted;
};

export function TrainWeekOverview({
  durationWeeks,
  weekIndex,
  nextDaySortOrder,
  days,
  completedDayIdsThisWeek,
  inProgressSession,
  lastCompleted,
}: Props) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const startDay = useMutation({
    mutationFn: async (programDayId: string) => {
      const r = await fetch("/api/training/start-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programDayId }),
        ...browserApiFetchInit,
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Start failed");
      }
      return r.json() as Promise<{ sessionId: string }>;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["training-active"] }),
  });

  const reorderDay = useMutation({
    mutationFn: async (p: { programDayId: string; programExerciseIds: string[] }) => {
      const r = await fetch("/api/training/active", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "setPlannedOrder",
          programDayId: p.programDayId,
          programExerciseIds: p.programExerciseIds,
        }),
        ...browserApiFetchInit,
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Reorder failed");
      }
      return r.json();
    },
    onMutate: async ({ programDayId, programExerciseIds }) => {
      await qc.cancelQueries({ queryKey: ["training-active"] });
      const prev = qc.getQueryData<TrainingActiveCache>(["training-active"]);
      if (!prev?.instance) return { prev };
      qc.setQueryData(["training-active"], {
        ...prev,
        instance: {
          ...prev.instance,
          program: {
            ...prev.instance.program,
            days: prev.instance.program.days.map((d) =>
              d.id !== programDayId
                ? d
                : {
                    ...d,
                    exercises: programExerciseIds
                      .map((id) => d.exercises.find((e) => e.id === id))
                      .filter((e): e is (typeof d.exercises)[number] => e != null),
                  },
            ),
          },
        },
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["training-active"], ctx.prev);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ["training-active"] }),
  });

  const [swapTarget, setSwapTarget] = useState<{
    programExerciseId: string;
    name: string;
    muscleTags?: string;
    dayId: string;
  } | null>(null);

  const sorted = useMemo(() => [...days].sort((a, b) => a.sortOrder - b.sortOrder), [days]);

  const displayWeek = weekIndex + 1;

  const onDragEndForDay = (programDayId: string, exercises: ScheduleDay["exercises"]) => (event: DragEndEvent) => {
    if (reorderDay.isPending) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = exercises.findIndex((e) => e.id === active.id);
    const newIndex = exercises.findIndex((e) => e.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(exercises, oldIndex, newIndex);
    reorderDay.mutate({
      programDayId,
      programExerciseIds: next.map((e) => e.id),
    });
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-muted/30 px-4 py-3">
        <p className="text-sm font-medium font-heading">
          Week {displayWeek} of {durationWeeks}
        </p>
        <p className="text-muted-foreground text-xs mt-1">
          One full pass through every training day below advances to the next week.
        </p>
        {lastCompleted && (
          <p className="text-xs mt-2 text-foreground">
            <span className="text-muted-foreground">Last session: </span>
            <span className="font-medium">{lastCompleted.dayLabel}</span>
            <span className="text-muted-foreground"> · Week {lastCompleted.weekIndex + 1} · </span>
            {format(new Date(lastCompleted.performedAt), "EEE MMM d")}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-0.5">
          Training split
        </p>
        {sorted.map((day) => {
          const isOpen = expanded[day.id] ?? false;
          const done = completedDayIdsThisWeek.includes(day.id);
          const inProgress = inProgressSession?.programDayId === day.id;
          const isNextSlot = day.sortOrder === nextDaySortOrder && !done && !inProgress;
          const canReorder = !inProgress;

          let status: "done" | "in_progress" | "next" | "later";
          if (inProgress) status = "in_progress";
          else if (done) status = "done";
          else if (isNextSlot) status = "next";
          else status = "later";

          return (
            <Card
              key={day.id}
              className={cn(
                "rounded-xl overflow-hidden border transition-colors",
                status === "next" && "border-primary/40 bg-primary/5",
                status === "in_progress" && "border-amber-500/40 bg-amber-500/5",
              )}
            >
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-left min-h-12 hover:bg-muted/40"
                onClick={() => setExpanded((s) => ({ ...s, [day.id]: !isOpen }))}
                aria-expanded={isOpen}
              >
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{day.label}</div>
                  <div className="text-muted-foreground text-xs">
                    {day.exercises.length} exercise{day.exercises.length === 1 ? "" : "s"}
                  </div>
                </div>
                <DayStatusBadge status={status} />
                {inProgressSession?.programDayId === day.id ? (
                  <Link
                    href={`/workout/${inProgressSession.id}`}
                    className={cn(
                      buttonVariants({ size: "sm", variant: "default" }),
                      "shrink-0 rounded-lg inline-flex items-center justify-center min-h-9 px-3",
                    )}
                  >
                    Continue
                  </Link>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="shrink-0 rounded-lg"
                    disabled={
                      startDay.isPending ||
                      (inProgressSession != null && inProgressSession.programDayId !== day.id)
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      startDay.mutate(day.id, {
                        onSuccess: (d) => {
                          window.location.href = `/workout/${d.sessionId}`;
                        },
                      });
                    }}
                  >
                    {startDay.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        <Play className="size-4 sm:mr-1" />
                        <span className="hidden sm:inline">Start</span>
                      </>
                    )}
                  </Button>
                )}
              </button>
              {isOpen && (
                <CardContent className="border-t bg-card/50 pt-0 pb-4 px-4">
                  {canReorder && day.exercises.length > 0 && (
                    <p className="text-muted-foreground text-xs mt-3 mb-1">
                      Drag the handle to reorder this day before you start.
                    </p>
                  )}
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={onDragEndForDay(day.id, day.exercises)}
                  >
                    <SortableContext
                      items={day.exercises.map((e) => e.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <ul className={cn("mt-2 space-y-2", !canReorder && "mt-3")}>
                        {day.exercises.map((ex) => (
                          <SortableWorkoutBlock key={ex.id} id={ex.id} disabled={!canReorder}>
                            {(handle) => (
                              <li className="text-sm rounded-lg border bg-background px-3 py-2 flex flex-row items-start gap-2">
                                {canReorder ? handle : null}
                                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                  <span className="font-medium">{ex.exercise.name}</span>
                                  <span className="text-muted-foreground text-xs">
                                    {ex.sets} × {ex.repTarget} @ ~{ex.targetRpe} RPE
                                    {ex.pctOf1rm != null ? ` · ${ex.pctOf1rm}% 1RM` : ""}
                                  </span>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="shrink-0 h-8 px-2 text-muted-foreground"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSwapTarget({
                                      programExerciseId: ex.id,
                                      name: ex.exercise.name,
                                      muscleTags: ex.exercise.muscleTags,
                                      dayId: day.id,
                                    });
                                  }}
                                >
                                  <Replace className="size-4" />
                                  <span className="sr-only sm:not-sr-only sm:ml-1">Swap</span>
                                </Button>
                              </li>
                            )}
                          </SortableWorkoutBlock>
                        ))}
                      </ul>
                    </SortableContext>
                  </DndContext>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <ExerciseSwapDialog
        open={swapTarget != null}
        onOpenChange={(o) => {
          if (!o) setSwapTarget(null);
        }}
        programExerciseId={swapTarget?.programExerciseId ?? ""}
        currentExerciseName={swapTarget?.name ?? ""}
        currentExerciseMuscleTags={swapTarget?.muscleTags}
        sessionId={
          swapTarget && inProgressSession?.programDayId === swapTarget.dayId
            ? inProgressSession.id
            : null
        }
        onSuccess={() => void qc.invalidateQueries({ queryKey: ["training-active"] })}
      />
    </div>
  );
}

function DayStatusBadge({ status }: { status: "done" | "in_progress" | "next" | "later" }) {
  switch (status) {
    case "done":
      return (
        <Badge variant="secondary" className="shrink-0 text-xs">
          Done
        </Badge>
      );
    case "in_progress":
      return (
        <Badge className="shrink-0 text-xs bg-amber-600 hover:bg-amber-600/90 text-white border-0">
          In progress
        </Badge>
      );
    case "next":
      return (
        <Badge variant="default" className="shrink-0 text-xs">
          Next up
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="shrink-0 text-xs text-muted-foreground">
          Scheduled
        </Badge>
      );
  }
}
