"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
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
import { browserApiFetchInit } from "@/lib/browser-api-fetch";

type TrainingActivePayload = {
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
};

export default function HomePage() {
  const qc = useQueryClient();
  const active = useQuery({
    queryKey: ["training-active"],
    queryFn: async () => {
      const r = await fetch("/api/training/active", browserApiFetchInit);
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<TrainingActivePayload>;
    },
  });

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
    mutationFn: async (instanceId: string) => {
      const r = await fetch("/api/training/skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId }),
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

  const { instance, nextDay, inProgressSession, lastCompleted, completedDayIdsThisWeek } =
    active.data ?? {};

  if (!instance) {
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

  const scheduleDays = instance.program.days ?? [];
  const sessionHref = inProgressSession ? `/workout/${inProgressSession.id}` : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-heading">Train</h1>
        <p className="text-muted-foreground text-sm">{instance.program.name}</p>
      </div>

      <TrainWeekOverview
        durationWeeks={instance.program.durationWeeks}
        weekIndex={instance.weekIndex}
        nextDaySortOrder={instance.nextDaySortOrder}
        days={scheduleDays}
        completedDayIdsThisWeek={completedDayIdsThisWeek ?? []}
        inProgressSession={inProgressSession ?? null}
        lastCompleted={lastCompleted ?? null}
      />

      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="bg-muted/40">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-xl">{nextDay?.label ?? "—"}</CardTitle>
              <CardDescription>Next session in your split</CardDescription>
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
              disabled={start.isPending}
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
              disabled={skip.isPending}
              onClick={() => skip.mutate(instance.id)}
            >
              <SkipForward className="size-4" />
              Skip / shift next day
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
    </div>
  );
}
