"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
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

const BLOCK_TYPES = ["HYPERTROPHY", "STRENGTH", "PEAKING"] as const;

function defaultBlocks(weeks: number) {
  const hEnd = Math.min(4, weeks);
  const sStart = Math.min(5, weeks);
  return [
    { blockType: "HYPERTROPHY", startWeek: 1, endWeek: hEnd },
    { blockType: "STRENGTH", startWeek: sStart, endWeek: weeks },
  ];
}

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
  };
}

type Props = {
  mode: "create" | "edit";
  programId?: string;
  initial?: ProgramWizardPayload | null;
  hasWorkoutHistory?: boolean;
};

export function ProgramBuilderForm({ mode, programId, initial, hasWorkoutHistory }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial?.name ?? "My program");
  const [durationWeeks, setDurationWeeks] = useState(initial?.durationWeeks ?? 8);
  const [blocks, setBlocks] = useState(initial?.blocks ?? defaultBlocks(8));
  const [days, setDays] = useState<WizardDay[]>(initial?.days ?? defaultDays());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setDurationWeeks(initial.durationWeeks);
      setBlocks(initial.blocks);
      setDays(initial.days);
    }
  }, [initial]);

  const { data: exerciseList } = useQuery({
    queryKey: ["all-exercises-catalog"],
    queryFn: async () => {
      const r = await fetch("/api/exercises");
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<{ slug: string; name: string }[]>;
    },
  });

  const structureLocked = mode === "edit" && hasWorkoutHistory;

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

  const payload = (): ProgramWizardPayload => ({
    name,
    durationWeeks,
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

      if (structureLocked) {
        const r = await fetch(`/api/programs/${programId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), durationWeeks }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error((j as { error?: string }).error ?? "Save failed");
        router.push(`/programs/${programId}`);
        return;
      }

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

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href="/programs"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-fit -ml-2 gap-2 inline-flex")}
      >
        <ArrowLeft className="size-4" />
        Programs
      </Link>

      {structureLocked && (
        <Card className="rounded-xl border-amber-500/40 bg-amber-500/5">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Structure locked</CardTitle>
            <CardDescription>
              This program has logged sessions. You can change the name and duration only. Use
              &quot;Duplicate&quot; on the program page to copy and edit days/exercises.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="flex gap-2 text-sm text-muted-foreground">
        {["Meta", "Blocks", "Days"].map((l, i) => (
          <span key={l} className={step === i ? "text-foreground font-medium" : ""}>
            {i + 1}. {l}
          </span>
        ))}
      </div>

      {step === 0 && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Program details</CardTitle>
            <CardDescription>
              6–12 week mesocycles. Nothing is sent to the server until you use <span className="font-medium">Next</span>{" "}
              and finish with <span className="font-medium">Create program</span> or <span className="font-medium">Save</span>.
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
            <Button className="rounded-xl" onClick={() => setStep(1)}>
              Next
              <ArrowRight className="size-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 1 && !structureLocked && (
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Blocks</CardTitle>
              <CardDescription>
                Weeks must partition 1–{durationWeeks} with no gaps or overlaps so progression maps cleanly to
                mesocycles (validated on save).
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" className="rounded-lg" onClick={addBlock}>
              <Plus className="size-4" />
              Block
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {blocks.map((b, i) => (
              <div key={i} className="flex flex-wrap items-end gap-3 rounded-xl border p-3">
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={b.blockType}
                    onValueChange={(v) => v && updateBlock(i, { blockType: v })}
                  >
                    <SelectTrigger className="w-[160px] rounded-lg">
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
                <div className="space-y-1">
                  <Label className="text-xs">Start week</Label>
                  <NumericInput
                    className="w-20 rounded-lg"
                    value={b.startWeek}
                    onValueChange={(n) => updateBlock(i, { startWeek: n })}
                    min={1}
                    max={durationWeeks}
                    fallback={b.startWeek}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">End week</Label>
                  <NumericInput
                    className="w-20 rounded-lg"
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
                  className="rounded-lg shrink-0"
                  onClick={() => removeBlock(i)}
                  aria-label="Remove block"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button className="rounded-xl" onClick={() => setStep(2)}>
                Next
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && structureLocked && (
        <Card className="rounded-2xl">
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm mb-4">Blocks are fixed for programs with history.</p>
            <Button variant="outline" className="rounded-xl" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button className="rounded-xl ml-2" onClick={() => setStep(2)}>
              Next
              <ArrowRight className="size-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Training days</CardTitle>
              <CardDescription>Add exercises from your library.</CardDescription>
            </div>
            {!structureLocked && (
              <Button variant="outline" size="sm" className="rounded-lg" onClick={addDay}>
                <Plus className="size-4" />
                Day
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-8">
            {days.map((day, di) => (
              <div key={di} className="rounded-2xl border bg-muted/20 p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {!structureLocked && (
                    <>
                      <Button variant="ghost" size="icon" className="rounded-lg" onClick={() => moveDay(di, -1)}>
                        <GripVertical className="size-4 rotate-90" />
                      </Button>
                      <Button variant="ghost" size="icon" className="rounded-lg" onClick={() => moveDay(di, 1)}>
                        <GripVertical className="size-4 -rotate-90" />
                      </Button>
                    </>
                  )}
                  <Input
                    value={day.label}
                    onChange={(e) => updateDayLabel(di, e.target.value)}
                    className="max-w-xs rounded-lg font-medium"
                    disabled={structureLocked}
                  />
                  {!structureLocked && (
                    <Button variant="ghost" size="sm" onClick={() => removeDay(di)}>
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
                <Separator />
                <ul className="space-y-4">
                  {day.exercises.map((ex, ei) => (
                    <li
                      key={ei}
                      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7 items-end rounded-xl border bg-card p-3"
                    >
                      <div className="lg:col-span-2 space-y-1">
                        <Label className="text-xs">Exercise</Label>
                        <Select
                          value={ex.exerciseSlug}
                          onValueChange={(v) => v && updateEx(di, ei, { exerciseSlug: v })}
                          disabled={structureLocked}
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
                        <Label className="text-xs">Sets</Label>
                        <NumericInput
                          className="rounded-lg"
                          value={ex.sets}
                          disabled={structureLocked}
                          onValueChange={(n) => updateEx(di, ei, { sets: n })}
                          min={1}
                          max={99}
                          fallback={ex.sets}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Rep target</Label>
                        <NumericInput
                          className="rounded-lg"
                          value={ex.repTarget}
                          disabled={structureLocked}
                          onValueChange={(n) => updateEx(di, ei, { repTarget: n })}
                          min={1}
                          max={999}
                          fallback={ex.repTarget}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">RPE</Label>
                        <NumericInput
                          decimals
                          snapHalf
                          className="rounded-lg"
                          value={ex.targetRpe}
                          disabled={structureLocked}
                          onValueChange={(n) => updateEx(di, ei, { targetRpe: n })}
                          min={6}
                          max={10}
                          fallback={ex.targetRpe}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">%1RM</Label>
                        <NullableNumericInput
                          className="rounded-lg"
                          placeholder="—"
                          value={ex.pctOf1rm ?? null}
                          disabled={structureLocked}
                          onValueChange={(n) => updateEx(di, ei, { pctOf1rm: n })}
                          min={0}
                          max={100}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Superset</Label>
                        <Select
                          value={ex.supersetGroup ?? "none"}
                          onValueChange={(v) =>
                            updateEx(di, ei, { supersetGroup: v === "none" ? null : v })
                          }
                          disabled={structureLocked}
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
                          disabled={structureLocked}
                          onValueChange={(n) => updateEx(di, ei, { restSec: n })}
                          min={15}
                          max={3600}
                        />
                      </div>
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
                          disabled={structureLocked}
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
                      {!structureLocked && (
                        <div className="lg:col-span-7 flex justify-end">
                          <Button variant="ghost" size="sm" onClick={() => removeExercise(di, ei)}>
                            Remove exercise
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                {!structureLocked && (
                  <Button variant="secondary" size="sm" className="rounded-lg" onClick={() => addExercise(di)}>
                    <Plus className="size-4" />
                    Exercise
                  </Button>
                )}
              </div>
            ))}

            {error && <p className="text-destructive text-sm">{error}</p>}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button className="rounded-xl" disabled={loading} onClick={submit}>
                {loading ? <Loader2 className="animate-spin" /> : mode === "create" ? "Create program" : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
