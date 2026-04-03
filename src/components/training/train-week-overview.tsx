"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronDown, Replace } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExerciseSwapDialog } from "@/components/training/exercise-swap-dialog";
import { cn } from "@/lib/utils";

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
    exercise: { id: string; name: string; slug: string };
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
  const [swapTarget, setSwapTarget] = useState<{
    programExerciseId: string;
    name: string;
    dayId: string;
  } | null>(null);

  const sorted = useMemo(() => [...days].sort((a, b) => a.sortOrder - b.sortOrder), [days]);

  const displayWeek = weekIndex + 1;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-muted/30 px-4 py-3">
        <p className="text-sm font-medium font-heading">Week {displayWeek} of {durationWeeks}</p>
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
              </button>
              {isOpen && (
                <CardContent className="border-t bg-card/50 pt-0 pb-4 px-4">
                  <ul className="mt-3 space-y-2">
                    {day.exercises.map((ex) => (
                      <li
                        key={ex.id}
                        className="text-sm rounded-lg border bg-background px-3 py-2 flex flex-row items-start gap-2"
                      >
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
                              dayId: day.id,
                            });
                          }}
                        >
                          <Replace className="size-4" />
                          <span className="sr-only sm:not-sr-only sm:ml-1">Swap</span>
                        </Button>
                      </li>
                    ))}
                  </ul>
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
