"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Loader2 } from "lucide-react";
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
import { displayFromKg } from "@/lib/calculators";

type Series = {
  slug: string;
  label: string;
  points: { week: string; volumeKg: number; bestE1rmKg: number }[];
};

export default function AnalyticsPage() {
  const q = useQuery({
    queryKey: ["analytics-big3"],
    queryFn: async () => {
      const r = await fetch("/api/analytics/big3");
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<{ series: Series[] }>;
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
        <p className="text-muted-foreground text-sm">Big 3 — volume (kg) and best e1RM (kg) by week</p>
        <Link href="/settings" className="text-xs text-primary underline-offset-4 hover:underline mt-1 inline-block">
          ← Back to Settings
        </Link>
      </div>

      {q.data.series.map((s) => (
        <Card key={s.slug} className="rounded-2xl">
          <CardHeader>
            <CardTitle>{s.label}</CardTitle>
            <CardDescription>Completed work only</CardDescription>
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
                          ? `${displayFromKg(v, "LB").toFixed(0)} lb est.`
                          : `${v.toFixed(0)} kg vol.`,
                        label,
                      ];
                    }}
                  />
                  <Legend />
                  <Line
                    yAxisId="v"
                    type="monotone"
                    dataKey="volumeKg"
                    name="Volume load (kg)"
                    stroke="var(--color-chart-1)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    yAxisId="e"
                    type="monotone"
                    dataKey="bestE1rmKg"
                    name="Best e1RM (kg)"
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
