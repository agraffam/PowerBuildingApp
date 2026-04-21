"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NullableNumericInput, NumericInput } from "@/components/ui/numeric-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { ProgramWizardPayload, WizardDay, WizardExercise } from "@/lib/program-wizard-types";
import { defaultMesocycleBlocks } from "@/lib/program-periodization";

const BLOCK_TYPES = ["HYPERTROPHY", "STRENGTH", "PEAKING"] as const;
const PERIODIZATION_STYLES = ["LINEAR", "ALTERNATING", "UNDULATING"] as const;

function defaultDays(): WizardDay[] {
  return [
    {
      label: "Upper A",
      exercises: [
        { exerciseSlug: "bench-press", sets: 4, repTarget: 6, targetRpe: 8, pctOf1rm: 78, restSec: 180 },
        { exerciseSlug: "barbell-row", sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
      ],
    },
    {
      label: "Lower A",
      exercises: [
        { exerciseSlug: "squat", sets: 4, repTarget: 6, targetRpe: 8, pctOf1rm: 78, restSec: 210 },
        { exerciseSlug: "romanian-deadlift", sets: 3, repTarget: 8, targetRpe: 8, restSec: 120 },
      ],
    },
  ];
}

function emptyExercise(): WizardExercise {
  return {
    exerciseSlug: "bench-press",
    sets: 3,
    repTarget: 8,
    targetRpe: 8,
    pctOf1rm: null,
    restSec: 120,
    useBodyweight: null,
    supersetGroup: null,
    notes: null,
    targetDurationSec: null,
    targetCalories: null,
  };
}

type Props = {
  mode: "create" | "edit";
  programId?: string;
  initial?: ProgramWizardPayload | null;
};

function exerciseKindForSlug(
  list: { slug: string; kind: string }[] | undefined,
  slug: string,
): "STRENGTH" | "CARDIO" {
  const k = list?.find((e) => e.slug === slug)?.kind;
  return k === "CARDIO" ? "CARDIO" : "STRENGTH";
}

export function ProgramBuilderForm({
  mode,
  programId,
  initial,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial?.name ?? "My program");
  const [durationWeeks, setDurationWeeks] = useState(initial?.durationWeeks ?? 8);
  const [deloadIntervalWeeks, setDeloadIntervalWeeks] = useState<number | null>(() => {
    if (!initial) return 5;
    return initial.deloadIntervalWeeks === undefined ? 5 : initial.deloadIntervalWeeks;
  });
  const [autoBlockPrescriptions, setAutoBlockPrescriptions] = useState(
    initial?.autoBlockPrescriptions !== false,
  );
  const [periodizationStyle, setPeriodizationStyle] = useState<
    "LINEAR" | "ALTERNATING" | "UNDULATING"
  >(initial?.periodizationStyle ?? "LINEAR");
  const [includePeaking, setIncludePeaking] = useState(
    () => initial?.blocks?.some((b) => b.blockType === "PEAKING") ?? false,
  );
  const [blocks, setBlocks] = useState(
    initial?.blocks ?? defaultMesocycleBlocks(8, false),
  );
  const [days, setDays] = useState<WizardDay[]>(initial?.days ?? defaultDays());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setDurationWeeks(initial.durationWeeks);
      setBlocks(initial.blocks);
      setDays(initial.days);
      setDeloadIntervalWeeks(
        initial.deloadIntervalWeeks === undefined ? 5 : initial.deloadIntervalWeeks,
      );
      setAutoBlockPrescriptions(initial.autoBlockPrescriptions !== false);
      setPeriodizationStyle(initial.periodizationStyle ?? "LINEAR");
      setIncludePeaking(initial.blocks?.some((b) => b.blockType === "PEAKING") ?? false);
    }
  }, [initial]);

  const { data: exerciseList } = useQuery({
    queryKey: ["all-exercises-catalog"],
    queryFn: async () => {
      const r = await fetch("/api/exercises");
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<{ slug: string; name: string; kind: string }[]>;
    },
  });

  const updateBlock = (i: number, patch: Partial<(typeof blocks)[0]>) => {
    setBlocks((b) => b.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  };

  const addBlock = () => {
    setBlocks((b) => [
      ...b,
      {
        blockType: "PEAKING",
        startWeek: Math.min(durationWeeks, 1),
        endWeek: durationWeeks,
      },
    ]);
  };

  const removeBlock = (i: number) => {
    setBlocks((b) => b.filter((_, j) => j !== i));
  };

  const updateDayLabel = (i: number, label: string) => {
    setDays((d) => d.map((x, j) => (j === i ? { ...x, label } : x)));
  };

  const addDay = () => {
    setDays((d) => [...d, { label: `Day ${d.length + 1}`, exercises: [emptyExercise()] }]);
  };

  const removeDay = (i: number) => {
    setDays((d) => d.filter((_, j) => j !== i));
  };

  const moveDay = (i: number, dir: -1 | 1) => {
    setDays((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.length) return d;
      const next = [...d];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  };

  const updateEx = (di: number, ei: number, patch: Partial<WizardExercise>) => {
    setDays((d) =>
      d.map((day, j) =>
        j !== di
          ? day
          : {
              ...day,
              exercises: day.exercises.map((ex, k) => (k === ei ? { ...ex, ...patch } : ex)),
            },
      ),
    );
  };

  const addExercise = (di: number) => {
    setDays((d) =>
      d.map((day, j) =>
        j !== di ? day : { ...day, exercises: [...day.exercises, emptyExercise()] },
      ),
    );
  };

  const removeExercise = (di: number, ei: number) => {
    setDays((d) =>
      d.map((day, j) =>
        j !== di
          ? day
          : { ...day, exercises: day.exercises.filter((_, k) => k !== ei) },
      ),
    );
  };

  const moveExercise = (di: number, ei: number, dir: -1 | 1) => {
    setDays((d) =>
      d.map((day, j) => {
        if (j !== di) return day;
        const k = ei + dir;
        if (k < 0 || k >= day.exercises.length) return day;
        const next = [...day.exercises];
        [next[ei], next[k]] = [next[k]!, next[ei]!];
        return { ...day, exercises: next };
      }),
    );
  };

  const payload = (): ProgramWizardPayload => ({
    name,
    durationWeeks,
    deloadIntervalWeeks,
    autoBlockPrescriptions,
    periodizationStyle,
    blocks,
    days,
  });

  const submit = async () => {
    const ae = document.activeElement;
    if (ae instanceof HTMLElement) ae.blur();
    await new Promise((r) => setTimeout(r, 0));
    setLoading(true);
    setError(null);
    try {
      if (mode === "create") {
        const r = await fetch("/api/programs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload()),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error((j as { error?: string }).error ?? "Save failed");
        router.push("/programs");
        return;
      }

      if (!programId) throw new Error("Missing program id");

      const r = await fetch(`/api/programs/${programId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "Save failed");
      router.push(`/programs/${programId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const stepLabels = ["Details", "Blocks", "Days"] as const;

  return (
    <div className="page-stack mx-auto max-w-2xl">
      <Link
        href="/programs"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "-ml-2 inline-flex w-fit gap-2 rounded-xl",
        )}
      >
        <ArrowLeft className="size-4" />
        Programs
      </Link>

      <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {stepLabels.map((l, i) => (
          <span
            key={l}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              step === i
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {i + 1}. {l}
          </span>
        ))}
      </div>

      {step === 0 && (
        <Card className="rounded-2xl shadow-sm ring-1 ring-foreground/5">
          <CardHeader>
            <CardTitle className="font-heading">Program details</CardTitle>
            <CardDescription className="leading-relaxed">
              <span className="sm:hidden">6–12 week mesocycles. Tap Next, then finish on the last step to save.</span>
              <span className="hidden sm:inline">
                6–12 week mesocycles. Nothing is sent to the server until you use <span className="font-medium">Next</span>{" "}
                and finish with <span className="font-medium">Create program</span> or{" "}
                <span className="font-medium">Save</span>.
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Duration (weeks)</Label>
              <NumericInput
                value={durationWeeks}
                onValueChange={setDurationWeeks}
                min={6}
                max={12}
                fallback={8}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Deload every (weeks)</Label>
              <Select
                value={deloadIntervalWeeks === null ? "off" : String(deloadIntervalWeeks)}
                onValueChange={(v) => {
                  if (v === "off") setDeloadIntervalWeeks(null);
                  else setDeloadIntervalWeeks(Number(v));
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Off</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="6">6</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Deload weeks ease volume and intensity on a fixed cadence (e.g. week 5, 10 when set to 5).
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-xl border bg-muted/20 p-3">
              <input
                type="checkbox"
                id="includePeaking"
                className="mt-1 rounded border-input"
                checked={includePeaking}
                onChange={(e) => setIncludePeaking(e.target.checked)}
              />
              <Label htmlFor="includePeaking" className="cursor-pointer font-normal leading-snug">
                Include final peaking block (best for 10+ week programs)
              </Label>
            </div>
            <div className="space-y-2">
              <Label>Periodization style</Label>
              <Select value={periodizationStyle} onValueChange={(v) => setPeriodizationStyle(v as typeof periodizationStyle)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODIZATION_STYLES.map((style) => (
                    <SelectItem key={style} value={style}>
                      {style[0] + style.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Linear ramps weekly load, Alternating toggles hard/easy weeks, Undulating waves stress across the block.
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-xl border bg-muted/20 p-3">
              <input
                type="checkbox"
                id="autoRx"
                className="mt-1 rounded border-input"
                checked={autoBlockPrescriptions}
                onChange={(e) => setAutoBlockPrescriptions(e.target.checked)}
              />
              <Label htmlFor="autoRx" className="cursor-pointer font-normal leading-snug">
                Auto-adjust sets/reps/RPE by block (hypertrophy → strength → peak)
              </Label>
            </div>
            <Button
              className="h-11 w-full rounded-xl sm:h-10 sm:w-auto"
              onClick={() => {
                setBlocks(defaultMesocycleBlocks(durationWeeks, includePeaking));
                setStep(1);
              }}
            >
              Next
              <ArrowRight className="size-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card className="rounded-2xl shadow-sm ring-1 ring-foreground/5">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <CardTitle className="font-heading">Blocks</CardTitle>
              <CardDescription className="leading-relaxed">
                <span className="sm:hidden">
                  Weeks 1–{durationWeeks} must partition cleanly (no gaps/overlaps). Checked when you save.
                </span>
                <span className="hidden sm:inline">
                  Weeks must partition 1–{durationWeeks} with no gaps or overlaps so progression maps cleanly to
                  mesocycles (validated on save).
                </span>
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" className="h-10 w-full shrink-0 rounded-xl sm:h-9 sm:w-auto" onClick={addBlock}>
              <Plus className="size-4" />
              Block
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {blocks.map((b, i) => (
              <div
                key={i}
                className="flex flex-col gap-3 rounded-xl border bg-muted/10 p-3 sm:flex-row sm:flex-wrap sm:items-end"
              >
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={b.blockType}
                    onValueChange={(v) => v && updateBlock(i, { blockType: v })}
                  >
                    <SelectTrigger className="h-11 w-full rounded-lg sm:h-10 sm:w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BLOCK_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-1 flex-col gap-1 sm:flex-initial">
                  <Label className="text-xs">Start week</Label>
                  <NumericInput
                    className="h-11 w-full rounded-lg sm:h-10 sm:w-20"
                    value={b.startWeek}
                    onValueChange={(n) => updateBlock(i, { startWeek: n })}
                    min={1}
                    max={durationWeeks}
                    fallback={b.startWeek}
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1 sm:flex-initial">
                  <Label className="text-xs">End week</Label>
                  <NumericInput
                    className="h-11 w-full rounded-lg sm:h-10 sm:w-20"
                    value={b.endWeek}
                    onValueChange={(n) => updateBlock(i, { endWeek: n })}
                    min={1}
                    max={durationWeeks}
                    fallback={b.endWeek}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 shrink-0 self-end rounded-lg sm:h-10 sm:self-end"
                  onClick={() => removeBlock(i)}
                  aria-label="Remove block"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="h-11 w-full rounded-xl sm:h-10 sm:w-auto" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button className="h-11 w-full rounded-xl sm:h-10 sm:w-auto" onClick={() => setStep(2)}>
                Next
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="rounded-2xl shadow-sm ring-1 ring-foreground/5">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <CardTitle className="font-heading">Training days</CardTitle>
              <CardDescription>Add exercises from your library.</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="h-10 w-full shrink-0 rounded-xl sm:h-9 sm:w-auto" onClick={addDay}>
              <Plus className="size-4" />
              Day
            </Button>
          </CardHeader>
          <CardContent className="space-y-8 max-sm:space-y-9">
            {days.map((day, di) => (
              <div key={di} className="space-y-3 rounded-2xl border bg-muted/20 p-4 shadow-sm ring-1 ring-foreground/5">
                <div className="flex flex-wrap items-center gap-2">
                  <>
                    <Button variant="ghost" size="icon" className="rounded-lg" onClick={() => moveDay(di, -1)}>
                      <GripVertical className="size-4 rotate-90" />
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-lg" onClick={() => moveDay(di, 1)}>
                      <GripVertical className="size-4 -rotate-90" />
                    </Button>
                  </>
                  <Input
                    value={day.label}
                    onChange={(e) => updateDayLabel(di, e.target.value)}
                    className="min-w-0 flex-1 rounded-lg font-medium sm:max-w-xs"
                  />
                  <Button variant="ghost" size="sm" onClick={() => removeDay(di)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <Separator />
                <ul className="space-y-4">
                  {day.exercises.map((ex, ei) => {
                    const slotTuningEnabled = true;
                    const rowIsCardio = exerciseKindForSlug(exerciseList, ex.exerciseSlug) === "CARDIO";
                    return (
                    <li key={ei} className="rounded-xl border bg-card p-3 space-y-3">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground mr-1">Reorder</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg shrink-0"
                          disabled={ei === 0}
                          onClick={() => moveExercise(di, ei, -1)}
                          aria-label="Move exercise up in this day"
                        >
                          <ChevronUp className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg shrink-0"
                          disabled={ei >= day.exercises.length - 1}
                          onClick={() => moveExercise(di, ei, 1)}
                          aria-label="Move exercise down in this day"
                        >
                          <ChevronDown className="size-4" />
                        </Button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7 items-end">
                      <div className="lg:col-span-2 space-y-1">
                        <Label className="text-xs">Exercise</Label>
                        <Select
                          value={ex.exerciseSlug}
                          onValueChange={(v) => v && updateEx(di, ei, { exerciseSlug: v })}
                        >
                          <SelectTrigger className="rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(exerciseList ?? []).map((opt) => (
                              <SelectItem key={opt.slug} value={opt.slug}>
                                {opt.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{rowIsCardio ? "Bouts" : "Sets"}</Label>
                        <NumericInput
                          className="rounded-lg"
                          value={ex.sets}
                          onValueChange={(n) => updateEx(di, ei, { sets: n })}
                          min={1}
                          max={99}
                          fallback={ex.sets}
                        />
                      </div>
                      {!rowIsCardio && (
                        <>
                      <div className="space-y-1">
                        <Label className="text-xs">Rep target</Label>
                          <NumericInput
                            className="rounded-lg"
                            value={ex.repTarget ?? 8}
                            onValueChange={(n) => updateEx(di, ei, { repTarget: n })}
                            min={1}
                            max={999}
                            fallback={ex.repTarget ?? 8}
                          />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">RPE</Label>
                          <NumericInput
                            decimals
                            snapHalf
                            className="rounded-lg"
                            value={ex.targetRpe ?? 8}
                            onValueChange={(n) => updateEx(di, ei, { targetRpe: n })}
                            min={6}
                            max={10}
                            fallback={ex.targetRpe ?? 8}
                          />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">%1RM</Label>
                        <NullableNumericInput
                          className="rounded-lg"
                          placeholder="—"
                          value={ex.pctOf1rm ?? null}
                          onValueChange={(n) => updateEx(di, ei, { pctOf1rm: n })}
                          min={0}
                          max={100}
                        />
                      </div>
                        </>
                      )}
                      <div className="space-y-1">
                        <Label className="text-xs">Superset</Label>
                        <Select
                          value={ex.supersetGroup ?? "none"}
                          onValueChange={(v) =>
                            updateEx(di, ei, { supersetGroup: v === "none" ? null : v })
                          }
                        >
                          <SelectTrigger className="rounded-lg">
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="A">A</SelectItem>
                            <SelectItem value="B">B</SelectItem>
                            <SelectItem value="C">C</SelectItem>
                            <SelectItem value="D">D</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Rest (s)</Label>
                        <NullableNumericInput
                          className="rounded-lg"
                          value={ex.restSec ?? null}
                          disabled={!slotTuningEnabled}
                          onValueChange={(n) => updateEx(di, ei, { restSec: n })}
                          min={15}
                          max={3600}
                        />
                      </div>
                      {!rowIsCardio && (
                      <div className="space-y-1">
                        <Label className="text-xs">Bodyweight</Label>
                        <Select
                          value={
                            ex.useBodyweight === null || ex.useBodyweight === undefined
                              ? "inherit"
                              : ex.useBodyweight
                                ? "yes"
                                : "no"
                          }
                          onValueChange={(v) =>
                            updateEx(di, ei, {
                              useBodyweight: v === "inherit" ? null : v === "yes",
                            })
                          }
                          disabled={!slotTuningEnabled}
                        >
                          <SelectTrigger className="rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="inherit">Use library default</SelectItem>
                            <SelectItem value="yes">Yes (BW)</SelectItem>
                            <SelectItem value="no">No (load)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      )}
                      <div className="lg:col-span-7 flex justify-end">
                        <Button variant="ghost" size="sm" onClick={() => removeExercise(di, ei)}>
                          Remove exercise
                        </Button>
                      </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Slot notes</Label>
                        <textarea
                          className={cn(
                            "flex min-h-[72px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
                            "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                            "disabled:cursor-not-allowed disabled:opacity-50",
                          )}
                          value={ex.notes ?? ""}
                          onChange={(e) => updateEx(di, ei, { notes: e.target.value || null })}
                          disabled={!slotTuningEnabled}
                          placeholder="Coaching cues for this slot…"
                        />
                      </div>
                      {rowIsCardio && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <p className="sm:col-span-2 text-xs text-muted-foreground">
                            Cardio slots use bouts, target time, and optional calories. Reps/RPE/%1RM are not
                            shown here; workouts use duration and calories for logging.
                          </p>
                          <div className="space-y-1">
                            <Label className="text-xs">Target time (seconds)</Label>
                            <NullableNumericInput
                              className="rounded-lg"
                              value={ex.targetDurationSec ?? null}
                              disabled={!slotTuningEnabled}
                              onValueChange={(n) => updateEx(di, ei, { targetDurationSec: n })}
                              min={0}
                              max={86400}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Target calories (optional)</Label>
                            <NullableNumericInput
                              className="rounded-lg"
                              value={ex.targetCalories ?? null}
                              disabled={!slotTuningEnabled}
                              onValueChange={(n) => updateEx(di, ei, { targetCalories: n })}
                              min={0}
                              max={50000}
                            />
                          </div>
                        </div>
                      )}
                    </li>
                    );
                  })}
                </ul>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-10 w-full rounded-xl sm:h-9 sm:w-auto"
                  onClick={() => addExercise(di)}
                >
                  <Plus className="size-4" />
                  Exercise
                </Button>
              </div>
            ))}

            {error && <p className="text-destructive text-sm">{error}</p>}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="h-11 w-full rounded-xl sm:h-10 sm:w-auto" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button className="h-11 w-full rounded-xl sm:h-10 sm:w-auto" disabled={loading} onClick={submit}>
                {loading ? <Loader2 className="animate-spin" /> : mode === "create" ? "Create program" : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
