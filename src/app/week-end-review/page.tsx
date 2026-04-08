"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type WeekEndReviewPayload = {
  review: {
    programName: string;
    weekIndex: number;
    sessionsCompleted: number;
    totalVolume: number;
    totalVolumeUnit: "KG" | "LB";
    bestTopSet: string | null;
    adherenceRate: number;
    daysInWeek: number;
    accountedDays: number;
  } | null;
};

export default function WeekEndReviewPage() {
  const q = useQuery({
    queryKey: ["week-end-review"],
    queryFn: async () => {
      const r = await fetch("/api/training/week-end-review");
      if (!r.ok) throw new Error("Failed to load week-end review");
      return (await r.json()) as WeekEndReviewPayload;
    },
  });

  if (q.isLoading || !q.data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!q.data.review) {
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Week-end review</CardTitle>
          <CardDescription>No active program yet.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
            Back to Train
          </Link>
        </CardContent>
      </Card>
    );
  }

  const r = q.data.review;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Week-end review</h1>
        <p className="text-muted-foreground text-sm">
          {r.programName} · Week {r.weekIndex + 1}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sessions completed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{r.sessionsCompleted}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Total volume</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {r.totalVolume} {r.totalVolumeUnit.toLowerCase()}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Best top set</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{r.bestTopSet ?? "No top set logged yet"}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Adherence</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {(r.adherenceRate * 100).toFixed(0)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {r.accountedDays}/{r.daysInWeek} days completed or skipped
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
