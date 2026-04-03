"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-heading">Workout history</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Open a session to edit sets. Deleting removes it from history and analytics; it does not change your
          current program week or next day.
        </p>
      </div>

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
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                href={`/workout/${s.id}`}
                className="block rounded-2xl border bg-card px-4 py-3 transition-colors hover:bg-muted/40"
              >
                <div className="font-medium text-sm">{s.programName}</div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  {s.dayLabel} · Week {s.weekIndex + 1} ·{" "}
                  {format(new Date(s.performedAt), "EEE MMM d, yyyy")}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {total > sessions.length && (
        <p className="text-muted-foreground text-xs">Showing {sessions.length} of {total} workouts.</p>
      )}
    </div>
  );
}
