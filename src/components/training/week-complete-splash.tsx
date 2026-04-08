"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { WeekCompletionSummaryPayload } from "@/lib/week-completion-summary";
import { weekVolumeDisplay } from "@/lib/week-completion-summary";
import { cn } from "@/lib/utils";
import { browserApiFetchInit } from "@/lib/browser-api-fetch";

type Props = {
  open: boolean;
  summary: WeekCompletionSummaryPayload | null;
  instanceId: string;
  /** After a successful week advance (e.g. navigate away from workout). */
  onAfterAdvance?: () => void;
};

export function WeekCompleteSplash({ open, summary, instanceId, onAfterAdvance }: Props) {
  const qc = useQueryClient();

  const advance = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/training/advance-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId }),
        ...browserApiFetchInit,
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string; programCompleted?: boolean };
      if (!r.ok) throw new Error(j.error ?? "Could not advance week");
      return j;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["training-active"] });
      await qc.invalidateQueries({ queryKey: ["training-history"] });
      onAfterAdvance?.();
    },
  });

  if (!summary) return null;

  const unitLabel = summary.displayUnit === "KG" ? "kg" : "lb";
  const totalDisplay = weekVolumeDisplay(summary.weekTotalVolumeKg, summary.displayUnit);
  const isLastWeek = summary.weekIndex + 1 >= summary.durationWeeks;

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "w-[calc(100vw-1.5rem)] max-w-xl max-h-[min(100dvh-2rem,800px)] overflow-y-auto rounded-2xl gap-0 p-0 sm:w-full",
        )}
      >
        <div className="px-6 pt-8 pb-6 space-y-6">
          <DialogHeader className="text-left space-y-2">
            <DialogTitle className="text-2xl sm:text-3xl font-heading pr-8 flex items-center gap-2">
              <CalendarCheck className="size-8 shrink-0 text-primary" aria-hidden />
              Week complete
            </DialogTitle>
            <DialogDescription className="text-base text-foreground">
              <span className="font-medium">{summary.programName}</span>
              <span className="text-muted-foreground">
                {" "}
                · Week {summary.weekIndex + 1} of {summary.durationWeeks}
              </span>
            </DialogDescription>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Every training day this week was either finished or skipped. Review this week, then continue to
            the next week.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border bg-muted/30 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Workouts</p>
              <p className="text-xl font-semibold tabular-nums mt-1">
                {summary.workoutsCompleted} done
                {summary.workoutsSkipped > 0 && (
                  <span className="text-base font-normal text-muted-foreground">
                    {" "}
                    · {summary.workoutsSkipped} skipped
                  </span>
                )}
              </p>
            </div>
            <div className="rounded-xl border bg-muted/30 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Week volume</p>
              <p className="text-xl font-semibold tabular-nums mt-1">
                {totalDisplay} {unitLabel}
              </p>
            </div>
          </div>

          {summary.completedSessions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Completed</p>
              <ul className="rounded-xl border divide-y max-h-40 overflow-y-auto">
                {summary.completedSessions.map((s) => (
                  <li key={s.sessionId} className="px-3 py-2.5 text-sm flex flex-col gap-0.5">
                    <span className="font-medium">{s.programDayLabel}</span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {weekVolumeDisplay(s.totalVolumeKg, summary.displayUnit)} {unitLabel}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.skippedDays.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Skipped</p>
              <ul className="rounded-xl border divide-y">
                {summary.skippedDays.map((s) => (
                  <li key={s.programDayId} className="px-3 py-2.5 text-sm">
                    {s.label}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-col gap-2 pt-2">
            <Button
              type="button"
              className="w-full rounded-xl h-12"
              disabled={advance.isPending}
              onClick={() => advance.mutate()}
            >
              {advance.isPending ? (
                <Loader2 className="size-5 animate-spin" />
              ) : isLastWeek ? (
                "Complete program"
              ) : (
                `Start week ${summary.weekIndex + 2}`
              )}
            </Button>
            {advance.isError && (
              <p className="text-destructive text-sm text-center">{(advance.error as Error).message}</p>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
