"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Play, SkipForward } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  const [dismissedWeekKey, setDismissedWeekKey] = useState<string | null>(null);

  const active = useQuery({
    queryKey: ["training-active"],
    queryFn: async () => {
      const r = await fetch("/api/training/active", browserApiFetchInit);
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<TrainingActivePayload>;
    },
  });

  const instance = active.data?.instance;
  const weekKey = instance ? `${instance.id}-${instance.weekIndex}` : "";
  const weekPendingFinalize = Boolean(active.data?.weekPendingFinalize);
  const weekSummary = active.data?.weekSummary ?? null;

  const showWeekSplash = Boolean(
    weekPendingFinalize && weekSummary && dismissedWeekKey !== weekKey,
  );

  const showWeekBanner = Boolean(
    weekPendingFinalize && weekSummary && dismissedWeekKey === weekKey,
  );

  useEffect(() => {
    if (!weekPendingFinalize) setDismissedWeekKey(null);
  }, [weekPendingFinalize]);

  const dismissWeekStay = useCallback(() => {
    const d = qc.getQueryData<TrainingActivePayload>(["training-active"]);
    if (d?.weekPendingFinalize && d?.weekSummary && d.instance) {
      setDismissedWeekKey(`${d.instance.id}-${d.instance.weekIndex}`);
    }
  }, [qc]);

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
    <div className="space-y-6">
      <div>
        <div className="flex items-end justify-between gap-2">
          <h1 className="text-2xl font-bold tracking-tight font-heading">Train</h1>
          <span className="text-xs text-muted-foreground">v{active.data?.appVersion ?? "0.000"}</span>
        </div>
        <p className="text-muted-foreground text-sm">{inst.program.name}</p>
      </div>

      {showWeekBanner && weekSummary && (
        <Card className="rounded-xl border-primary/30 bg-primary/5 shadow-sm">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">
              <span className="font-medium">Week {weekSummary.weekIndex + 1} is ready to close.</span>{" "}
              Open the summary to move on or finish the program.
            </p>
            <Button type="button" className="rounded-xl shrink-0" onClick={() => setDismissedWeekKey(null)}>
              Open week summary
            </Button>
          </CardContent>
        </Card>
      )}

      <TrainWeekOverview
        instanceId={inst.id}
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
        <CardHeader className="bg-muted/40">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-xl">{nextDay?.label ?? "—"}</CardTitle>
              <CardDescription>
                {weekPendingFinalize ? "Finish the week review above to start week workouts." : "Next session in your split"}
              </CardDescription>
            </div>
            <Badge variant="secondary">Up next</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-6">
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

          {!inProgressSession && (
            <Button
              variant="outline"
              className="h-12 rounded-xl"
              disabled={skip.isPending || weekPendingFinalize}
              onClick={() => skip.mutate({ instanceId: inst.id })}
            >
              <SkipForward className="size-4" />
              Skip next workout
            </Button>
          )}

          {start.isError && (
            <p className="text-destructive text-sm">{(start.error as Error).message}</p>
          )}
          {skip.isError && (
            <p className="text-destructive text-sm">{(skip.error as Error).message}</p>
          )}
        </CardContent>
      </Card>

      {weekSummary && (
        <WeekCompleteSplash
          open={showWeekSplash}
          summary={weekSummary}
          instanceId={inst.id}
          onDismissStay={dismissWeekStay}
        />
      )}
    </div>
  );
}
