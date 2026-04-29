"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { ProgramBuilderForm } from "@/components/programs/program-builder-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProgramWizardPayload } from "@/lib/program-wizard-types";

type ProgramDetail = {
  id: string;
  name: string;
  durationWeeks: number;
  deloadIntervalWeeks: number | null;
  autoBlockPrescriptions: boolean;
  periodizationStyle?: "LINEAR" | "ALTERNATING" | "UNDULATING";
  blocks: { blockType: string; startWeek: number; endWeek: number }[];
  days: {
    id: string;
    label: string;
    exercises: {
      id: string;
      sets: number;
      repTarget: number | null;
      targetRpe: number | null;
      pctOf1rm: number | null;
      restSec: number | null;
      useBodyweight: boolean | null;
      supersetGroup: string | null;
      notes: string | null;
      targetDurationSec: number | null;
      targetCalories: number | null;
      exercise: { slug: string };
    }[];
  }[];
};

function toWizard(p: ProgramDetail): ProgramWizardPayload {
  return {
    name: p.name,
    durationWeeks: p.durationWeeks,
    deloadIntervalWeeks: p.deloadIntervalWeeks,
    autoBlockPrescriptions: p.autoBlockPrescriptions,
    periodizationStyle: p.periodizationStyle ?? "LINEAR",
    blocks: p.blocks.map((b) => ({ blockType: b.blockType, startWeek: b.startWeek, endWeek: b.endWeek })),
    days: p.days.map((d) => ({
      label: d.label,
      exercises: d.exercises.map((e) => ({
        exerciseSlug: e.exercise.slug,
        sets: e.sets,
        repTarget: e.repTarget,
        targetRpe: e.targetRpe,
        pctOf1rm: e.pctOf1rm,
        restSec: e.restSec,
        useBodyweight: e.useBodyweight,
        supersetGroup: e.supersetGroup,
        notes: e.notes,
        targetDurationSec: e.targetDurationSec,
        targetCalories: e.targetCalories,
      })),
    })),
  };
}

function isProgramWizardPayload(value: unknown): value is ProgramWizardPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as ProgramWizardPayload;
  return (
    typeof v.name === "string" &&
    typeof v.durationWeeks === "number" &&
    Array.isArray(v.blocks) &&
    Array.isArray(v.days)
  );
}

export default function NewProgramPage() {
  const [startMode, setStartMode] = useState<"choose" | "copy" | "json">("choose");
  const [startScratch, setStartScratch] = useState(false);
  const [initial, setInitial] = useState<ProgramWizardPayload | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const programs = useQuery({
    queryKey: ["programs"],
    queryFn: async () => {
      const r = await fetch("/api/programs");
      if (!r.ok) throw new Error("Failed to load programs");
      return r.json() as Promise<{ id: string; name: string }[]>;
    },
  });

  const selectedName = useMemo(
    () => programs.data?.find((p) => p.id === selectedProgramId)?.name ?? "",
    [programs.data, selectedProgramId],
  );

  const loadCopy = async () => {
    setError(null);
    if (!selectedProgramId) return;
    const r = await fetch(`/api/programs/${selectedProgramId}`);
    if (!r.ok) {
      setError("Could not load the selected template.");
      return;
    }
    const j = (await r.json()) as { program: ProgramDetail };
    const payload = toWizard(j.program);
    payload.name = `${selectedName || payload.name} copy`;
    setInitial(payload);
  };

  const applyJson = () => {
    setError(null);
    try {
      const parsed = JSON.parse(jsonText) as unknown;
      if (!isProgramWizardPayload(parsed)) {
        setError("JSON must match ProgramWizardPayload shape.");
        return;
      }
      setInitial(parsed);
    } catch {
      setError("Invalid JSON.");
    }
  };

  if (startScratch) {
    return <ProgramBuilderForm mode="create" />;
  }
  if (initial) {
    return <ProgramBuilderForm mode="create" initial={initial} />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Start a new program</CardTitle>
          <CardDescription>Choose how you want to initialize the builder.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <Button
              type="button"
              variant={startScratch ? "default" : "outline"}
              onClick={() => {
                setStartScratch(true);
                setStartMode("choose");
              }}
            >
              Start from scratch
            </Button>
            <Button type="button" variant={startMode === "copy" ? "default" : "outline"} onClick={() => { setStartScratch(false); setStartMode("copy"); }}>
              Copy existing
            </Button>
            <Button type="button" variant={startMode === "json" ? "default" : "outline"} onClick={() => { setStartScratch(false); setStartMode("json"); }}>
              Paste JSON
            </Button>
          </div>
          {startMode === "copy" && (
            <div className="space-y-2 rounded-xl border p-3">
              <Label>Program to copy</Label>
              <Select value={selectedProgramId} onValueChange={(value) => setSelectedProgramId(value ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a program" />
                </SelectTrigger>
                <SelectContent>
                  {(programs.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" disabled={!selectedProgramId || programs.isLoading} onClick={() => void loadCopy()}>
                {programs.isLoading ? <Loader2 className="size-4 animate-spin" /> : "Load into builder"}
              </Button>
            </div>
          )}
          {startMode === "json" && (
            <div className="space-y-2 rounded-xl border p-3">
              <Label>Program JSON payload</Label>
              <textarea
                className="min-h-40 w-full rounded-lg border bg-background p-2 text-sm"
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder='{"name":"My Program","durationWeeks":8,"blocks":[],"days":[]}'
              />
              <Button type="button" onClick={applyJson}>Load JSON</Button>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
