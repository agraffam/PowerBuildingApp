"use client";

import { useQuery } from "@tanstack/react-query";
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
import { PageHeader } from "@/components/page-header";
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

  useEffect(() => {
    if (!q.data?.availableExercises?.length) return;
    setTrackedIds((prev) => {
      if (prev.length === 0) return prev;
      const byId = new Map(q.data.availableExercises.map((ex) => [ex.id, ex.id]));
      const bySlug = new Map(q.data.availableExercises.map((ex) => [ex.slug.toLowerCase(), ex.id]));
      const normalized = prev
        .map((value) => {
          if (byId.has(value)) return byId.get(value)!;
          const fromSlug = bySlug.get(value.toLowerCase());
          return fromSlug ?? null;
        })
        .filter((v): v is string => v != null);
      const unique = Array.from(new Set(normalized));
      const unchanged = unique.length === prev.length && unique.every((v, i) => v === prev[i]);
      return unchanged ? prev : unique;
    });
  }, [q.data?.availableExercises]);

  if (q.isLoading || !q.data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="page-stack mx-auto max-w-5xl">
      <PageHeader
        title="Analytics"
        description={`Volume and best e1RM trends in your preferred unit (${q.data.displayUnit.toLowerCase()}).`}
        backLink={{ href: "/settings", label: "← Back to Settings" }}
      />

      <Card className="rounded-2xl shadow-sm ring-1 ring-foreground/5">
        <CardHeader>
          <CardTitle className="text-base font-heading">Tracked exercises</CardTitle>
          <CardDescription className="leading-relaxed">
            <span className="sm:hidden">Pick up to three primaries, then add more lifts to track.</span>
            <span className="hidden sm:inline">
              Select up to 3 primary lifts, and add/remove additional tracked lifts.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-2">
            {[0, 1, 2].map((slot) => {
              const current = trackedIds[slot] ?? "";
              const currentName = q.data.availableExercises.find((ex) => ex.id === current)?.name ?? "";
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
                  <SelectTrigger className="h-11 rounded-xl sm:h-10">
                    <SelectValue placeholder={`Primary ${slot + 1}`}>
                      {currentName || `Primary ${slot + 1}`}
                    </SelectValue>
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
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Select value={addExerciseId} onValueChange={(v) => setAddExerciseId(v ?? "")}>
              <SelectTrigger className="h-11 w-full min-w-0 rounded-xl sm:h-10 sm:w-[260px]">
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
              className="h-11 w-full shrink-0 rounded-xl sm:h-10 sm:w-auto"
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
                    className="inline-flex max-w-full items-center gap-1 rounded-xl sm:max-w-none"
                    onClick={() => setTrackedIds((prev) => prev.filter((v) => v !== id))}
                  >
                    <span className="min-w-0 truncate">{ex?.name ?? "Unknown exercise"}</span>
                    <span className="shrink-0">×</span>
                  </Button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {q.data.series.map((s) => (
        <Card key={s.slug} className="rounded-2xl shadow-sm ring-1 ring-foreground/5">
          <CardHeader className="space-y-1">
            <CardTitle className="font-heading text-lg leading-snug">{s.label}</CardTitle>
            <CardDescription className="leading-relaxed">
              Current estimated 1RM:{" "}
              {s.currentEstimatedOneRmDisplay != null
                ? `${s.currentEstimatedOneRmDisplay.toFixed(1)} ${q.data.displayUnit.toLowerCase()}`
                : "not available yet"}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[min(42svh,20rem)] min-h-[220px] sm:h-72 sm:min-h-0">
            {s.points.length === 0 ? (
              <p className="text-sm text-muted-foreground">Log sessions to see trends.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={s.points}
                  margin={{ top: 8, right: 4, left: -18, bottom: 4 }}
                  className="text-xs sm:text-sm"
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis yAxisId="v" width={36} tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="e" orientation="right" width={36} tick={{ fontSize: 10 }} />
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
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
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
