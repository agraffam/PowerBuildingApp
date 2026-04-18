"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Loader2, Play, SkipForward } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { TrainWeekOverview, type ScheduleDay } from "@/components/training/train-week-overview";
import { WeekCompleteSplash } from "@/components/training/week-complete-splash";
import type { WeekCompletionSummaryPayload } from "@/lib/week-completion-summary";
import { browserApiFetchInit } from "@/lib/browser-api-fetch";

type TrainingActivePayload = {
  appVersion?: string;
  instance: {
    id: string;
    weekIndex: number;
    nextDaySortOrder: number;
    programId: string;
    program: {
      name: string;
      durationWeeks: number;
      days: ScheduleDay[];
    };
  } | null;
  nextDay: { id: string; label: string } | null;
  inProgressSession: { id: string; programDayId: string } | null;
  lastCompleted: {
    sessionId: string;
    weekIndex: number;
    performedAt: string;
    dayLabel: string;
    daySortOrder: number;
    programDayId: string;
  } | null;
  completedDayIdsThisWeek: string[];
  skippedDayIdsThisWeek?: string[];
  weekPendingFinalize?: boolean;
  weekSummary?: WeekCompletionSummaryPayload | null;
};

export default function HomePage() {
  const qc = useQueryClient();
  const [skipOpen, setSkipOpen] = useState(false);

  const active = useQuery({
    queryKey: ["training-active"],
    queryFn: async () => {
      const r = await fetch("/api/training/active", browserApiFetchInit);
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<TrainingActivePayload>;
    },
  });

  const weekPendingFinalize = Boolean(active.data?.weekPendingFinalize);
  const weekSummary = active.data?.weekSummary ?? null;
  const showWeekSplash = Boolean(weekPendingFinalize && weekSummary);

  const start = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/training/start-session", { method: "POST", ...browserApiFetchInit });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Start failed");
      }
      return r.json() as Promise<{ sessionId: string }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["training-active"] }),
  });

  const skip = useMutation({
    mutationFn: async (p: { instanceId: string; programDayId?: string }) => {
      const r = await fetch("/api/training/skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
        ...browserApiFetchInit,
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Skip failed");
      }
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["training-active"] }),
  });

  if (active.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { instance: inst, nextDay, inProgressSession, lastCompleted, completedDayIdsThisWeek } =
    active.data ?? {};

  if (!inst) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>No active program</CardTitle>
          <CardDescription>
            Seed the database or activate a program from the Programs tab.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/programs" className={cn(buttonVariants({ size: "default" }), "rounded-xl")}>
            Programs
          </Link>
        </CardContent>
      </Card>
    );
  }

  const scheduleDays = inst.program.days ?? [];
  const sessionHref = inProgressSession ? `/workout/${inProgressSession.id}` : null;
  const skippedDayIdsThisWeek = active.data?.skippedDayIdsThisWeek ?? [];

  return (
    <div className="page-stack">
      <PageHeader
        title="Train"
        meta={`v${active.data?.appVersion ?? "0.000"}`}
        description={inst.program.name}
      />

      <TrainWeekOverview
        instanceId={inst.id}
        programId={inst.programId}
        durationWeeks={inst.program.durationWeeks}
        weekIndex={inst.weekIndex}
        nextDaySortOrder={inst.nextDaySortOrder}
        days={scheduleDays}
        completedDayIdsThisWeek={completedDayIdsThisWeek ?? []}
        skippedDayIdsThisWeek={skippedDayIdsThisWeek}
        weekPendingFinalize={weekPendingFinalize}
        inProgressSession={inProgressSession ?? null}
        lastCompleted={lastCompleted ?? null}
      />

      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="bg-muted/40 [.border-b]:pb-4">
          <CardTitle className="text-xl leading-snug">{nextDay?.label ?? "—"}</CardTitle>
          <CardDescription className="text-pretty leading-relaxed">
            {weekPendingFinalize
              ? "Finish the week review above to start week workouts."
              : "Next session in your split"}
          </CardDescription>
          <CardAction>
            <Badge variant="secondary" className="shrink-0">
              Up next
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-5 sm:pt-6">
          {sessionHref ? (
            <Link
              href={sessionHref}
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-14 text-base rounded-xl gap-2 inline-flex items-center justify-center",
              )}
            >
              <Play className="size-5" />
              Continue workout
            </Link>
          ) : (
            <Button
              size="lg"
              className="h-14 text-base rounded-xl gap-2"
              disabled={start.isPending || weekPendingFinalize}
              onClick={() =>
                start.mutate(undefined, {
                  onSuccess: (d) => {
                    window.location.href = `/workout/${d.sessionId}`;
                  },
                })
              }
            >
              {start.isPending ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Play className="size-5" />
              )}
              Start workout
            </Button>
          )}

          {start.isError && (
            <p className="text-destructive text-sm">{(start.error as Error).message}</p>
          )}
          {skip.isError && !skipOpen && (
            <p className="text-destructive text-sm">{(skip.error as Error).message}</p>
          )}

          {!inProgressSession && (
            <div className="mt-1 border-t pt-4">
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-muted-foreground text-sm font-normal"
                disabled={skip.isPending || weekPendingFinalize}
                onClick={() => {
                  skip.reset();
                  setSkipOpen(true);
                }}
              >
                <SkipForward className="size-3.5 mr-1.5 inline align-middle" />
                Skip this workout instead…
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={skipOpen}
        onOpenChange={(open) => {
          setSkipOpen(open);
          if (!open) skip.reset();
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Skip {nextDay?.label ?? "next workout"}?</DialogTitle>
            <DialogDescription>
              This counts the session as skipped for the current week (no workout logged). You can unskip from the
              week list on Train if you change your mind.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col border-0 bg-transparent p-0 -mx-0 -mb-0">
            <Button
              type="button"
              variant="destructive"
              className="w-full rounded-xl"
              disabled={skip.isPending || weekPendingFinalize}
              onClick={() =>
                skip.mutate(
                  { instanceId: inst.id },
                  {
                    onSuccess: () => {
                      setSkipOpen(false);
                    },
                  },
                )
              }
            >
              {skip.isPending ? <Loader2 className="size-4 animate-spin" /> : "Skip workout"}
            </Button>
            <Button type="button" variant="outline" className="w-full rounded-xl" onClick={() => setSkipOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
          {skip.isError && (
            <p className="text-destructive text-sm">{(skip.error as Error).message}</p>
          )}
        </DialogContent>
      </Dialog>

      {weekSummary && (
        <WeekCompleteSplash
          open={showWeekSplash}
          summary={weekSummary}
          instanceId={inst.id}
        />
      )}
    </div>
  );
}
