"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ProgramBuilderForm } from "@/components/programs/program-builder-form";
import type { ProgramWizardPayload } from "@/lib/program-wizard-types";

type ProgramDetail = {
  id: string;
  name: string;
  durationWeeks: number;
  blocks: { blockType: string; startWeek: number; endWeek: number }[];
  days: {
    label: string;
    sortOrder: number;
    exercises: {
      sets: number;
      repTarget: number;
      targetRpe: number;
      pctOf1rm: number | null;
      restSec: number | null;
      supersetGroup: string | null;
      exercise: { slug: string };
    }[];
  }[];
};

function toWizard(p: ProgramDetail): ProgramWizardPayload {
  return {
    name: p.name,
    durationWeeks: p.durationWeeks,
    blocks: p.blocks.map((b) => ({
      blockType: b.blockType,
      startWeek: b.startWeek,
      endWeek: b.endWeek,
    })),
    days: p.days.map((d) => ({
      label: d.label,
      exercises: d.exercises.map((e) => ({
        exerciseSlug: e.exercise.slug,
        sets: e.sets,
        repTarget: e.repTarget,
        targetRpe: e.targetRpe,
        pctOf1rm: e.pctOf1rm,
        restSec: e.restSec,
        supersetGroup: e.supersetGroup,
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
      return r.json() as Promise<{ program: ProgramDetail; hasWorkoutHistory: boolean }>;
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
    <ProgramBuilderForm
      mode="edit"
      programId={programId}
      initial={initial}
      hasWorkoutHistory={data.hasWorkoutHistory}
    />
  );
}
