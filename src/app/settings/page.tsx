"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
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
  keepAwakeDuringWorkout?: boolean;
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
        keepAwakeDuringWorkout: boolean;
        restDurationsByRpe: Record<string, number>;
      }>;
    },
  });
  const { data: versionData } = useQuery({
    queryKey: ["app-version"],
    queryFn: async () => {
      const r = await fetch("/api/version");
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<{ version: string }>;
    },
    staleTime: 300_000,
  });

  const [unitDraft, setUnitDraft] = useState<"KG" | "LB">("LB");
  const [defaultRestDraft, setDefaultRestDraft] = useState(180);
  const [plateLbDraft, setPlateLbDraft] = useState(2.5);
  const [plateKgDraft, setPlateKgDraft] = useState(2.5);
  const [rpeRestDraft, setRpeRestDraft] = useState<Record<string, number> | null>(null);
  const [keepAwakeDuringWorkout, setKeepAwakeDuringWorkout] = useState(false);
  const { data: me } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const r = await fetch("/api/auth/me");
      const json = (await r.json()) as { user: { isSuperAdmin?: boolean } | null };
      if (!r.ok) return { user: null };
      return json;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!data) return;
    setUnitDraft(data.preferredWeightUnit);
    setDefaultRestDraft(data.defaultRestSec);
    setPlateLbDraft(data.plateIncrementLb);
    setPlateKgDraft(data.plateIncrementKg);
    setKeepAwakeDuringWorkout(data.keepAwakeDuringWorkout);
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
    if (keepAwakeDuringWorkout !== data.keepAwakeDuringWorkout) return true;
    return !rpeMapsEqual(rpeRestDraft, data.restDurationsByRpe);
  }, [
    data,
    rpeRestDraft,
    unitDraft,
    defaultRestDraft,
    plateLbDraft,
    plateKgDraft,
    keepAwakeDuringWorkout,
  ]);

  const saveAll = () => {
    if (!data || !rpeRestDraft) return;
    const body: SettingsPatchBody = {};
    if (unitDraft !== data.preferredWeightUnit) body.preferredWeightUnit = unitDraft;
    if (defaultRestDraft !== data.defaultRestSec) body.defaultRestSec = defaultRestDraft;
    if (plateLbDraft !== data.plateIncrementLb) body.plateIncrementLb = plateLbDraft;
    if (plateKgDraft !== data.plateIncrementKg) body.plateIncrementKg = plateKgDraft;
    if (keepAwakeDuringWorkout !== data.keepAwakeDuringWorkout) {
      body.keepAwakeDuringWorkout = keepAwakeDuringWorkout;
    }
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
        <div className="flex items-end justify-between gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <span className="text-xs text-muted-foreground">v{versionData?.version ?? "0.000"}</span>
        </div>
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
          <CardTitle>Workout experience</CardTitle>
          <CardDescription>Behavior while a workout screen is open.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <div>
              <p className="text-sm font-medium">Keep screen awake during workouts</p>
              <p className="text-xs text-muted-foreground">
                Best effort using browser support (may be limited on some iPhone Safari versions).
              </p>
            </div>
            <Button
              type="button"
              variant={keepAwakeDuringWorkout ? "default" : "outline"}
              className="rounded-xl shrink-0"
              onClick={() => setKeepAwakeDuringWorkout((v) => !v)}
            >
              {keepAwakeDuringWorkout ? "On" : "Off"}
            </Button>
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
              onClick={() => setRpeRestDraft({ ...defaultRestDurationsByRpe(defaultRestDraft) })}
            >
              Reset RPE times to defaults (draft)
            </Button>
          </div>
        </CardContent>
      </Card>

      <RestTimerNotificationsCard />

      <Card>
        <CardHeader>
          <CardTitle>Settings menu</CardTitle>
          <CardDescription>Additional pages moved here to keep the top header uncluttered.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/account" className="rounded-xl border px-3 py-2 text-sm hover:bg-muted">
            Account
          </Link>
          <Link href="/analytics" className="rounded-xl border px-3 py-2 text-sm hover:bg-muted">
            Analytics
          </Link>
          <Link href="/help" className="rounded-xl border px-3 py-2 text-sm hover:bg-muted">
            Help
          </Link>
          <Link href="/updates" className="rounded-xl border px-3 py-2 text-sm hover:bg-muted">
            Updates
          </Link>
          {me?.user?.isSuperAdmin && (
            <Link href="/admin" className="rounded-xl border px-3 py-2 text-sm hover:bg-muted">
              Admin
            </Link>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Training pages</CardTitle>
          <CardDescription>Shortcuts to your training setup and logs.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/programs" className="rounded-xl border px-3 py-2 text-sm hover:bg-muted">
            Programs
          </Link>
          <Link href="/exercises" className="rounded-xl border px-3 py-2 text-sm hover:bg-muted">
            Exercises
          </Link>
          <Link href="/history" className="rounded-xl border px-3 py-2 text-sm hover:bg-muted">
            History
          </Link>
          <Link href="/strength" className="rounded-xl border px-3 py-2 text-sm hover:bg-muted">
            1RM
          </Link>
        </CardContent>
      </Card>

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
