"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RestTimerNotificationsCard } from "@/components/settings/rest-timer-notifications-card";
import { Button } from "@/components/ui/button";
import { NumericInput } from "@/components/ui/numeric-input";
import {
  RPE_BAND_LABELS,
  RPE_REST_BAND_IDS,
  RPE_REST_SEC_OPTIONS,
  applyBandRestSec,
  defaultRestDurationsByRpe,
  rpeKeysForBand,
  rpeMapsEqual,
} from "@/lib/rest-by-rpe";

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

  const [unitDraft, setUnitDraft] = useState<"KG" | "LB">("LB");
  const [defaultRestDraft, setDefaultRestDraft] = useState(180);
  const [plateLbDraft, setPlateLbDraft] = useState(2.5);
  const [plateKgDraft, setPlateKgDraft] = useState(2.5);
  const [rpeRestDraft, setRpeRestDraft] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    if (!data) return;
    setUnitDraft(data.preferredWeightUnit);
    setDefaultRestDraft(data.defaultRestSec);
    setPlateLbDraft(data.plateIncrementLb);
    setPlateKgDraft(data.plateIncrementKg);
    setRpeRestDraft({ ...data.restDurationsByRpe });
  }, [data]);

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

  const dirty = useMemo(() => {
    if (!data || !rpeRestDraft) return false;
    if (unitDraft !== data.preferredWeightUnit) return true;
    if (defaultRestDraft !== data.defaultRestSec) return true;
    if (plateLbDraft !== data.plateIncrementLb) return true;
    if (plateKgDraft !== data.plateIncrementKg) return true;
    return !rpeMapsEqual(rpeRestDraft, data.restDurationsByRpe);
  }, [
    data,
    rpeRestDraft,
    unitDraft,
    defaultRestDraft,
    plateLbDraft,
    plateKgDraft,
  ]);

  const saveAll = () => {
    if (!data || !rpeRestDraft) return;
    const body: SettingsPatchBody = {};
    if (unitDraft !== data.preferredWeightUnit) body.preferredWeightUnit = unitDraft;
    if (defaultRestDraft !== data.defaultRestSec) body.defaultRestSec = defaultRestDraft;
    if (plateLbDraft !== data.plateIncrementLb) body.plateIncrementLb = plateLbDraft;
    if (plateKgDraft !== data.plateIncrementKg) body.plateIncrementKg = plateKgDraft;
    if (!rpeMapsEqual(rpeRestDraft, data.restDurationsByRpe)) {
      body.restDurationsByRpe = { ...rpeRestDraft };
    }
    if (Object.keys(body).length === 0) return;
    save.mutate(body);
  };

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
          <CardDescription>Preferences apply to new logged sets. Use Save changes below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Preferred weight unit</Label>
            <Select value={unitDraft} onValueChange={(v) => setUnitDraft(v as "KG" | "LB")}>
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
              <NumericInput
                className="rounded-xl"
                value={defaultRestDraft}
                onValueChange={setDefaultRestDraft}
                min={30}
                max={600}
                fallback={defaultRestDraft}
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
                value={String(plateLbDraft)}
                onValueChange={(v) => v && setPlateLbDraft(Number(v))}
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
              <NumericInput
                decimals
                className="rounded-xl"
                value={plateKgDraft}
                onValueChange={setPlateKgDraft}
                min={0.5}
                max={50}
                fallback={plateKgDraft}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rest timer by RPE</CardTitle>
          <CardDescription>
            After a set, rest length when your program does not set a fixed <span className="font-medium">rest</span>{" "}
            per exercise. If any lift in a superset has a prescribed rest (program editor), that still wins (longest
            in the group). Otherwise we use the RPE from your log (or target RPE) to pick a duration. Four bands (6–6.5
            through 9+) each use the same 30–210s steps; changing a band updates every half-step RPE in that range.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rpeRestDraft && (
            <div className="grid gap-3 sm:grid-cols-2">
              {RPE_REST_BAND_IDS.map((band) => {
                const sk = String(rpeKeysForBand(band)[0]!);
                const sec = rpeRestDraft[sk] ?? 60;
                return (
                  <div key={band} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{RPE_BAND_LABELS[band]}</Label>
                    <Select
                      value={String(sec)}
                      onValueChange={(v) => {
                        const n = Number(v);
                        if (!rpeRestDraft || !Number.isFinite(n)) return;
                        setRpeRestDraft(applyBandRestSec(rpeRestDraft, band, n));
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
              onClick={() => setRpeRestDraft({ ...defaultRestDurationsByRpe() })}
            >
              Reset RPE times to defaults (draft)
            </Button>
          </div>
        </CardContent>
      </Card>

      <RestTimerNotificationsCard />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border bg-muted/30 p-4">
        <Button
          type="button"
          className="rounded-xl sm:w-auto w-full"
          disabled={!dirty || save.isPending}
          onClick={() => saveAll()}
        >
          {save.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin mr-2 inline" />
              Saving…
            </>
          ) : (
            "Save changes"
          )}
        </Button>
        {dirty && (
          <p className="text-muted-foreground text-sm">You have unsaved changes.</p>
        )}
        {save.isSuccess && !dirty && (
          <p className="text-muted-foreground text-sm">All changes saved.</p>
        )}
        {save.isError && (
          <p className="text-destructive text-sm">Could not save. Try again.</p>
        )}
      </div>
    </div>
  );
}
