"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RPE_REST_KEYS, RPE_REST_SEC_OPTIONS } from "@/lib/rest-by-rpe";

type SettingsPatchBody = {
  preferredWeightUnit?: "KG" | "LB";
  defaultRestSec?: number;
  plateIncrementLb?: number;
  plateIncrementKg?: number;
  restDurationsByRpe?: Record<string, number> | null;
};

export default function SettingsPage() {
  const qc = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const r = await fetch("/api/settings");
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<{
        id: string;
        preferredWeightUnit: "KG" | "LB";
        defaultRestSec: number;
        plateIncrementLb: number;
        plateIncrementKg: number;
        restDurationsByRpe: Record<string, number>;
      }>;
    },
  });

  const [rpeRestDraft, setRpeRestDraft] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    if (data?.restDurationsByRpe) {
      setRpeRestDraft({ ...data.restDurationsByRpe });
    }
  }, [data?.restDurationsByRpe]);

  const save = useMutation({
    mutationFn: async (body: SettingsPatchBody) => {
      const r = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Save failed");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">Appearance, units, and timer defaults</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose light, dark, or match your device.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Theme</Label>
            <Select
              value={theme ?? "system"}
              onValueChange={(v) => {
                if (v === "light" || v === "dark" || v === "system") setTheme(v);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Training</CardTitle>
          <CardDescription>Preferences apply to new logged sets.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Preferred weight unit</Label>
            <Select
              value={data.preferredWeightUnit}
              onValueChange={(preferredWeightUnit) =>
                save.mutate({ preferredWeightUnit: preferredWeightUnit as "KG" | "LB" })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LB">Pounds (lb)</SelectItem>
                <SelectItem value="KG">Kilograms (kg)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Default rest (seconds)</Label>
              <Input
                type="number"
                defaultValue={data.defaultRestSec}
                onBlur={(e) =>
                  save.mutate({ defaultRestSec: Number(e.target.value) || data.defaultRestSec })
                }
              />
              <p className="text-muted-foreground text-xs">
                Fallback when rest can&apos;t be read from the RPE table (e.g. missing data). The table below uses
                fixed steps (30–210s); reset uses RPE 6–6.5 → 60s, 7–7.5 → 120s, 8+ → 180s.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Default bar increment (lb)</Label>
              <p className="text-muted-foreground text-xs">
                Per-lift overrides live on each exercise in the library. Kilogram increment stays a custom step for
                kg sessions.
              </p>
              <Select
                value={String(data.plateIncrementLb)}
                onValueChange={(v) => v && save.mutate({ plateIncrementLb: Number(v) })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2.5">2.5 lb</SelectItem>
                  <SelectItem value="5">5 lb</SelectItem>
                  <SelectItem value="10">10 lb</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Plate increment (kg)</Label>
              <Input
                type="number"
                step="0.5"
                defaultValue={data.plateIncrementKg}
                onBlur={(e) =>
                  save.mutate({ plateIncrementKg: Number(e.target.value) || data.plateIncrementKg })
                }
              />
            </div>
          </div>

          {save.isSuccess && (
            <p className="text-muted-foreground text-sm">Saved.</p>
          )}
          {save.isError && (
            <p className="text-destructive text-sm">Could not save.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rest timer by RPE</CardTitle>
          <CardDescription>
            After a set, rest length when your program does not set a fixed <span className="font-medium">rest</span>{" "}
            per exercise. If any lift in a superset has a prescribed rest (program editor), that still wins (longest
            in the group). Otherwise we use the RPE from your log (or target RPE) to pick a duration. Each row is one
            of 30–210 seconds in 30s steps.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rpeRestDraft && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {RPE_REST_KEYS.map((k) => {
                const sk = String(k);
                const sec = rpeRestDraft[sk] ?? 60;
                return (
                  <div key={sk} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">RPE {sk}</Label>
                    <Select
                      value={String(sec)}
                      onValueChange={(v) => {
                        const n = Number(v);
                        if (!rpeRestDraft || !Number.isFinite(n)) return;
                        const next = { ...rpeRestDraft, [sk]: n };
                        setRpeRestDraft(next);
                        save.mutate({ restDurationsByRpe: next });
                      }}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RPE_REST_SEC_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={String(opt)}>
                            {opt}s
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={save.isPending}
              onClick={() => {
                save.mutate(
                  { restDurationsByRpe: null },
                  {
                    onSuccess: (j) => {
                      const row = j as { restDurationsByRpe?: Record<string, number> };
                      if (row.restDurationsByRpe) setRpeRestDraft({ ...row.restDurationsByRpe });
                    },
                  },
                );
              }}
            >
              Reset to defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
