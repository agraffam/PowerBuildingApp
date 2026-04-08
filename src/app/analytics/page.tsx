"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Series = {
  exerciseId: string;
  slug: string;
  label: string;
  currentEstimatedOneRmDisplay: number | null;
  points: { week: string; volume: number; bestE1rm: number }[];
};

export default function AnalyticsPage() {
  const [trackedIds, setTrackedIds] = useState<string[]>([]);
  const [addExerciseId, setAddExerciseId] = useState<string>("");

  useEffect(() => {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem("analyticsTrackedExerciseIds") : null;
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed)) setTrackedIds(parsed.filter((v) => typeof v === "string"));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("analyticsTrackedExerciseIds", JSON.stringify(trackedIds));
  }, [trackedIds]);

  const qs = useMemo(
    () => (trackedIds.length > 0 ? `?exerciseIds=${encodeURIComponent(trackedIds.join(","))}` : ""),
    [trackedIds],
  );
  const q = useQuery({
    queryKey: ["analytics-big3", qs],
    queryFn: async () => {
      const r = await fetch(`/api/analytics/big3${qs}`);
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<{
        displayUnit: "KG" | "LB";
        availableExercises: { id: string; name: string; slug: string }[];
        series: Series[];
      }>;
    },
  });

  if (q.isLoading || !q.data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground text-sm">
          Volume and best e1RM trends in your preferred unit ({q.data.displayUnit.toLowerCase()}).
        </p>
        <Link href="/settings" className="text-xs text-primary underline-offset-4 hover:underline mt-1 inline-block">
          ← Back to Settings
        </Link>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Tracked exercises</CardTitle>
          <CardDescription>Select up to 3 primary lifts, and add/remove additional tracked lifts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            {[0, 1, 2].map((slot) => {
              const current = trackedIds[slot] ?? "";
              return (
                <Select
                  key={slot}
                  value={current}
                  onValueChange={(v) => {
                    const next = [...trackedIds];
                    next[slot] = v ?? "";
                    setTrackedIds(Array.from(new Set(next.filter(Boolean))));
                  }}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={`Primary ${slot + 1}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {q.data.availableExercises.map((ex) => (
                      <SelectItem key={ex.id} value={ex.id}>
                        {ex.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={addExerciseId} onValueChange={(v) => setAddExerciseId(v ?? "")}>
              <SelectTrigger className="rounded-xl w-[260px]">
                <SelectValue placeholder="Add another exercise to track" />
              </SelectTrigger>
              <SelectContent>
                {q.data.availableExercises
                  .filter((ex) => !trackedIds.includes(ex.id))
                  .map((ex) => (
                    <SelectItem key={ex.id} value={ex.id}>
                      {ex.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                if (!addExerciseId) return;
                setTrackedIds((prev) => Array.from(new Set([...prev, addExerciseId])));
                setAddExerciseId("");
              }}
            >
              Add
            </Button>
          </div>
          {trackedIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {trackedIds.map((id) => {
                const ex = q.data.availableExercises.find((e) => e.id === id);
                return (
                  <Button
                    key={id}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setTrackedIds((prev) => prev.filter((v) => v !== id))}
                  >
                    {ex?.name ?? id} ×
                  </Button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {q.data.series.map((s) => (
        <Card key={s.slug} className="rounded-2xl">
          <CardHeader>
            <CardTitle>{s.label}</CardTitle>
            <CardDescription>
              Current estimated 1RM:{" "}
              {s.currentEstimatedOneRmDisplay != null
                ? `${s.currentEstimatedOneRmDisplay.toFixed(1)} ${q.data.displayUnit.toLowerCase()}`
                : "not available yet"}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {s.points.length === 0 ? (
              <p className="text-muted-foreground text-sm">Log sessions to see trends.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={s.points}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="v" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="e" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value, name) => {
                      const v = typeof value === "number" ? value : Number(value);
                      const label = String(name);
                      if (Number.isNaN(v)) return [String(value), label];
                      return [
                        label.includes("e1RM")
                          ? `${v.toFixed(1)} ${q.data.displayUnit.toLowerCase()} est.`
                          : `${v.toFixed(1)} ${q.data.displayUnit.toLowerCase()} vol.`,
                        label,
                      ];
                    }}
                  />
                  <Legend />
                  <Line
                    yAxisId="v"
                    type="monotone"
                    dataKey="volume"
                    name={`Volume load (${q.data.displayUnit.toLowerCase()})`}
                    stroke="var(--color-chart-1)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    yAxisId="e"
                    type="monotone"
                    dataKey="bestE1rm"
                    name={`Best e1RM (${q.data.displayUnit.toLowerCase()})`}
                    stroke="var(--color-chart-2)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
