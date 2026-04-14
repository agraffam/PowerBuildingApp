"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { format } from "date-fns";
import { Loader2, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { browserApiFetchInit } from "@/lib/browser-api-fetch";

type HistoryRow = {
  id: string;
  performedAt: string;
  weekIndex: number;
  dayLabel: string;
  programId: string;
  programName: string;
};

type HistoryPayload = {
  sessions: HistoryRow[];
  total: number;
  limit: number;
  offset: number;
};

export default function HistoryPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["training-history"],
    queryFn: async () => {
      const r = await fetch("/api/training/history", browserApiFetchInit);
      if (r.status === 401) {
        window.location.assign("/login?next=/history");
        throw new Error("Unauthorized");
      }
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<HistoryPayload>;
    },
  });

  const del = useMutation({
    mutationFn: async (sessionId: string) => {
      const r = await fetch(`/api/training/sessions/${sessionId}`, {
        method: "DELETE",
        ...browserApiFetchInit,
      });
      if (r.status === 401) {
        window.location.assign("/login?next=/history");
        throw new Error("Unauthorized");
      }
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Delete failed");
      }
      return r.json();
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["training-history"] }),
  });

  if (q.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (q.isError) {
    return (
      <p className="text-center text-sm text-destructive py-12">
        Could not load workout history.
      </p>
    );
  }

  const { sessions, total } = q.data!;

  return (
    <div className="page-stack">
      <PageHeader
        title="Workout history"
        description={
          <>
            Open a session to edit sets or the workout date. Deleting removes it from history and analytics;
            it does not change your current program week or next day.
          </>
        }
        backLink={{ href: "/settings", label: "← Back to Settings" }}
      />

      {sessions.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardHeader>
            <CardTitle className="text-lg">No completed workouts yet</CardTitle>
            <CardDescription>Finish a session from Train to see it here.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/" className={cn(buttonVariants({ size: "default" }), "rounded-xl")}>
              Go to Train
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3 sm:space-y-2">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-2">
              <Link
                href={`/workout/${s.id}`}
                className="min-w-0 flex-1 rounded-2xl border bg-card px-4 py-3.5 transition-colors hover:bg-muted/40 sm:py-3"
              >
                <div className="text-sm font-medium leading-snug">{s.programName}</div>
                <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {s.dayLabel} · Week {s.weekIndex + 1} ·{" "}
                  {format(new Date(s.performedAt), "EEE MMM d, yyyy")}
                </div>
              </Link>
              <Button
                type="button"
                variant="outline"
                className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 sm:h-auto sm:w-12 sm:min-h-[4.5rem] sm:gap-0 sm:p-0"
                disabled={del.isPending}
                aria-label="Delete workout"
                onClick={() => {
                  if (!window.confirm("Delete this workout from history? This cannot be undone.")) return;
                  del.mutate(s.id);
                }}
              >
                {del.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="size-4 sm:mx-auto" />
                    <span className="text-sm font-medium sm:sr-only">Delete</span>
                  </>
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {del.isError && (
        <p className="text-destructive text-sm">{(del.error as Error).message}</p>
      )}

      {total > sessions.length && (
        <p className="text-muted-foreground text-xs">
          Showing {sessions.length} of {total} workouts.
        </p>
      )}
    </div>
  );
}
