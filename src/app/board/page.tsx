"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Trophy } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MonthlyBoardPayload } from "@/lib/monthly-board";

export default function BoardPage() {
  const q = useQuery({
    queryKey: ["stats", "monthly-board"],
    queryFn: async (): Promise<MonthlyBoardPayload> => {
      const r = await fetch("/api/stats/monthly-board", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load board");
      return r.json() as Promise<MonthlyBoardPayload>;
    },
    staleTime: 60_000,
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
      <p className="text-center text-sm text-destructive">
        Couldn&apos;t load the board. Try refreshing.
      </p>
    );
  }

  const data = q.data!;

  return (
    <div className="page-stack">
      <PageHeader
        title="The Board"
        description={`Top movers this month · ${data.monthLabel}`}
        leading={
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Trophy className="size-6" aria-hidden />
          </span>
        }
      />

      <div className="grid gap-7 md:grid-cols-2 md:gap-6">
        <BoardCard
          title="Workouts logged"
          description="Completed sessions this month"
          entries={data.workouts}
          currentUserId={data.currentUserId}
          formatValue={(n) => (n === 1 ? "1 workout" : `${n} workouts`)}
          empty="No completed workouts this month yet."
        />
        <BoardCard
          title="Volume"
          description="Estimated pounds lifted (weight × reps, all completed sets)"
          entries={data.volumeLb}
          currentUserId={data.currentUserId}
          formatValue={(n) => `${n.toLocaleString()} lb`}
          empty="No logged sets with weight this month yet."
        />
      </div>
    </div>
  );
}

function BoardCard({
  title,
  description,
  entries,
  currentUserId,
  formatValue,
  empty,
}: {
  title: string;
  description: string;
  entries: MonthlyBoardPayload["workouts"];
  currentUserId: string;
  formatValue: (n: number) => string;
  empty: string;
}) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">{empty}</p>
        ) : (
          <ol className="space-y-2">
            {entries.map((row) => {
              const isYou = row.userId === currentUserId;
              return (
                <li
                  key={`${row.userId}-${row.rank}`}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl border px-3 py-3.5 text-sm",
                    isYou && "border-primary/40 bg-primary/5",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="tabular-nums text-muted-foreground w-6 shrink-0">{row.rank}.</span>
                    <span className="min-w-0 truncate font-medium">
                      {row.displayName}
                      {isYou && (
                        <span className="text-muted-foreground ml-1.5 font-normal">(you)</span>
                      )}
                    </span>
                  </div>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{formatValue(row.value)}</span>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
