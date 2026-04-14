"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ProgramBuilderForm } from "@/components/programs/program-builder-form";
import type { ProgramWizardPayload } from "@/lib/program-wizard-types";

type ProgramDetail = {
  id: string;
  name: string;
  durationWeeks: number;
  deloadIntervalWeeks: number | null;
  autoBlockPrescriptions: boolean;
  ownerId: string | null;
  blocks: { blockType: string; startWeek: number; endWeek: number }[];
  days: {
    id: string;
    label: string;
    sortOrder: number;
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
      exercise: { slug: string; kind: "STRENGTH" | "CARDIO" };
    }[];
  }[];
};

function toWizard(p: ProgramDetail): ProgramWizardPayload {
  return {
    name: p.name,
    durationWeeks: p.durationWeeks,
    deloadIntervalWeeks: p.deloadIntervalWeeks,
    autoBlockPrescriptions: p.autoBlockPrescriptions,
    blocks: p.blocks.map((b) => ({
      blockType: b.blockType,
      startWeek: b.startWeek,
      endWeek: b.endWeek,
    })),
    days: p.days.map((d) => ({
      programDayId: d.id,
      label: d.label,
      exercises: d.exercises.map((e) => ({
        programExerciseId: e.id,
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

export default function EditProgramPage() {
  const params = useParams();
  const programId = params.programId as string;

  const { data, isLoading } = useQuery({
    queryKey: ["program", programId],
    queryFn: async () => {
      const r = await fetch(`/api/programs/${programId}`);
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<{
        program: ProgramDetail;
        hasWorkoutHistory: boolean;
        canEditStructure?: boolean;
      }>;
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const initial = toWizard(data.program);

  return (
    <div className="space-y-6 max-sm:space-y-5">
      <Link
        href="/programs"
        className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        ← Programs
      </Link>
      <ProgramBuilderForm mode="edit" programId={programId} initial={initial} />
    </div>
  );
}
