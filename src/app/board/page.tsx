"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Flame, Loader2, Sparkles, TrendingUp, Trophy, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Big3BoardColumn, MonthlyBoardEntry, MonthlyBoardPayload } from "@/lib/monthly-board";

const podiumTint = [
  "from-amber-500/25 via-amber-400/10 to-transparent border-amber-500/35",
  "from-zinc-400/20 via-zinc-300/10 to-transparent border-zinc-400/35",
  "from-amber-800/25 via-orange-900/10 to-transparent border-amber-800/40",
] as const;

function PodiumPreview({ entries, unitLabel }: { entries: MonthlyBoardEntry[]; unitLabel: string }) {
  const top = entries.slice(0, 3);
  const order = [top[1], top[0], top[2]].filter(Boolean) as MonthlyBoardEntry[];
  const heights = ["h-14", "h-[4.5rem]", "h-11"];
  return (
    <div className="flex items-end justify-center gap-2 pb-1 pt-3">
      {order.map((row, i) => {
        const rank = row.rank;
        const tint = rank <= 3 ? podiumTint[rank - 1] : "from-muted/40 to-transparent border-border";
        return (
          <div
            key={`${row.userId}-${rank}`}
            className={cn(
              "flex w-[30%] max-w-[6.5rem] flex-col items-center justify-end rounded-xl border bg-gradient-to-b px-1.5 pb-2 pt-2 text-center",
              tint,
              heights[i],
            )}
          >
            <span className="text-[10px] font-bold tabular-nums text-muted-foreground">{rank}</span>
            <span className="line-clamp-2 w-full text-[10px] font-semibold leading-tight">{row.displayName}</span>
            <span className="mt-0.5 text-[10px] font-bold tabular-nums text-primary">
              {row.value}
              {unitLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Big3LiftCard({
  column,
  currentUserId,
  unitLabel,
}: {
  column: Big3BoardColumn;
  currentUserId: string;
  unitLabel: string;
}) {
  const accent =
    column.slug === "squat"
      ? "shadow-violet-500/15 ring-violet-500/20"
      : column.slug === "bench-press"
        ? "shadow-sky-500/15 ring-sky-500/20"
        : "shadow-emerald-500/15 ring-emerald-500/20";

  return (
    <Card
      className={cn(
        "relative overflow-hidden rounded-2xl border-0 bg-gradient-to-b from-card to-card/80 ring-1 ring-inset",
        accent,
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-24 opacity-60 blur-2xl",
          column.slug === "squat" && "bg-violet-500/30",
          column.slug === "bench-press" && "bg-sky-500/30",
          column.slug === "deadlift" && "bg-emerald-500/30",
        )}
      />
      <CardHeader className="relative space-y-1 pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-heading tracking-tight">{column.label}</CardTitle>
          <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
            Est. 1RM
          </Badge>
        </div>
        <CardDescription className="text-xs">Best logged set this month (Brzycki).</CardDescription>
      </CardHeader>
      <CardContent className="relative space-y-3 pb-4">
        {column.entries.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">No logged sets yet.</p>
        ) : (
          <>
            <PodiumPreview entries={column.entries} unitLabel={unitLabel} />
            <ol className="space-y-1.5 border-t border-border/60 pt-3">
              {column.entries.map((row) => {
                const isYou = row.userId === currentUserId;
                return (
                  <li
                    key={`${column.slug}-${row.userId}-${row.rank}`}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-xs",
                      isYou && "bg-primary/8 ring-1 ring-primary/25",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="w-5 shrink-0 tabular-nums text-muted-foreground">{row.rank}</span>
                      <span className="min-w-0 truncate font-medium">
                        {row.displayName}
                        {isYou && <span className="ml-1 font-normal text-muted-foreground">· you</span>}
                      </span>
                    </div>
                    <span className="shrink-0 tabular-nums font-semibold text-foreground">
                      {row.value}
                      {unitLabel}
                    </span>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function BoardCard({
  title,
  description,
  entries,
  currentUserId,
  formatValue,
  empty,
  icon,
}: {
  title: string;
  description: string;
  entries: MonthlyBoardEntry[];
  currentUserId: string;
  formatValue: (n: number) => string;
  empty: string;
  icon: ReactNode;
}) {
  return (
    <Card className="rounded-2xl border bg-card/90 shadow-sm ring-1 ring-border/60">
      <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
          {icon}
        </span>
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription className="text-xs leading-relaxed">{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">{empty}</p>
        ) : (
          <ol className="space-y-1.5">
            {entries.map((row) => {
              const isYou = row.userId === currentUserId;
              return (
                <li
                  key={`${row.userId}-${row.rank}`}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl border border-transparent bg-muted/25 px-3 py-2.5 text-sm transition-colors",
                    isYou && "border-primary/35 bg-primary/10",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="w-6 shrink-0 tabular-nums text-muted-foreground">{row.rank}</span>
                    <span className="min-w-0 truncate font-medium">
                      {row.displayName}
                      {isYou && <span className="ml-1.5 font-normal text-muted-foreground">(you)</span>}
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
  const unitLabel = data.displayUnit === "KG" ? " kg" : " lb";
  const big3 = data.big3 ?? [];

  return (
    <div className="page-stack">
      <section className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-primary/20 via-card to-violet-950/20 p-6 shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/4 size-48 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md ring-2 ring-primary/30">
              <Trophy className="size-7" aria-hidden />
            </span>
            <div className="min-w-0 space-y-2">
              <PageHeader
                className="space-y-2 [&_h1]:text-3xl [&_h1]:sm:text-4xl"
                title="The Board"
                description="Monthly crew rankings — chase the podium on Squat, Bench, and Deadlift, then stack volume and consistency."
              />
              <div className="flex flex-wrap gap-2">
                <Badge className="rounded-lg bg-background/80 font-medium text-foreground shadow-sm">
                  <Sparkles className="mr-1 size-3.5" aria-hidden />
                  {data.monthLabel}
                </Badge>
                <Badge variant="secondary" className="rounded-lg">
                  <Users className="mr-1 size-3.5" aria-hidden />
                  {data.athleteCount} athlete{data.athleteCount === 1 ? "" : "s"} this month
                </Badge>
              </div>
            </div>
          </div>
          <p className="max-w-md text-pretty text-sm leading-relaxed text-muted-foreground sm:text-right">
            Best est. 1RM uses your strongest logged set of the month per lift. Volume is weight × reps (converted to
            lb). Tie-breaker: whoever logged first in the data wins — go train.
          </p>
        </div>
      </section>

      <div>
        <div className="mb-3 flex items-center gap-2">
          <Flame className="size-5 text-orange-500" aria-hidden />
          <h2 className="font-heading text-lg font-semibold tracking-tight">Big three · Est. 1RM</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {big3.map((col) => (
            <Big3LiftCard key={col.slug} column={col} currentUserId={data.currentUserId} unitLabel={unitLabel} />
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="size-5 text-primary" aria-hidden />
          <h2 className="font-heading text-lg font-semibold tracking-tight">Momentum</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <BoardCard
            title="Workouts logged"
            description="Completed sessions this month"
            entries={data.workouts}
            currentUserId={data.currentUserId}
            formatValue={(n) => (n === 1 ? "1 workout" : `${n} workouts`)}
            empty="No completed workouts this month yet."
            icon={<TrendingUp className="size-5" aria-hidden />}
          />
          <BoardCard
            title="Volume"
            description="Estimated pounds lifted (weight × reps, all completed sets)"
            entries={data.volumeLb}
            currentUserId={data.currentUserId}
            formatValue={(n) => `${n.toLocaleString()} lb`}
            empty="No logged sets with weight this month yet."
            icon={<Sparkles className="size-5" aria-hidden />}
          />
        </div>
      </div>
    </div>
  );
}
