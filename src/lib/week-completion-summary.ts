import type { WeightUnit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { displayFromKg, normalizeWeightToKg } from "@/lib/calculators";
import { getSkippedProgramDayIdsForWeek } from "@/lib/program-week-state";

export type WeekCompletionSummaryPayload = {
  weekIndex: number;
  durationWeeks: number;
  displayUnit: WeightUnit;
  programName: string;
  completedSessions: {
    sessionId: string;
    programDayLabel: string;
    totalVolumeKg: number;
    performedAt: string;
  }[];
  skippedDays: { programDayId: string; label: string }[];
  weekTotalVolumeKg: number;
  workoutsCompleted: number;
  workoutsSkipped: number;
};

export async function buildWeekCompletionSummary(
  userId: string,
  programInstanceId: string,
  weekIndex: number,
): Promise<WeekCompletionSummaryPayload | null> {
  const instance = await prisma.programInstance.findFirst({
    where: { id: programInstanceId, userId },
    include: {
      program: {
        select: {
          name: true,
          durationWeeks: true,
          days: { select: { id: true, sortOrder: true, label: true } },
        },
      },
    },
  });
  if (!instance) return null;

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const displayUnit: WeightUnit = settings?.preferredWeightUnit ?? "LB";

  const sessions = await prisma.workoutSession.findMany({
    where: {
      programInstanceId,
      status: "COMPLETED",
      weekIndex,
    },
    orderBy: { workoutCompletedAt: "asc" },
    include: {
      programDay: {
        select: {
          id: true,
          label: true,
          sortOrder: true,
          exercises: { select: { id: true, exerciseId: true, repTarget: true, targetRpe: true } },
        },
      },
      sets: true,
    },
  });

  const completedSessions: WeekCompletionSummaryPayload["completedSessions"] = [];
  let weekTotalVolumeKg = 0;

  for (const session of sessions) {
    const peById = new Map(session.programDay.exercises.map((pe) => [pe.id, pe]));
    let vol = 0;
    for (const row of session.sets) {
      if (!row.done) continue;
      const pe = peById.get(row.programExerciseId);
      if (!pe) continue;
      const reps = row.reps ?? pe.repTarget;
      const wu = row.weightUnit as WeightUnit;
      vol += normalizeWeightToKg(row.weight, wu) * (reps > 0 ? reps : 0);
    }
    weekTotalVolumeKg += vol;
    completedSessions.push({
      sessionId: session.id,
      programDayLabel: session.programDay.label,
      totalVolumeKg: vol,
      performedAt: (session.workoutCompletedAt ?? session.performedAt).toISOString(),
    });
  }

  const dayById = new Map(instance.program.days.map((d) => [d.id, d]));
  const skippedIds = await getSkippedProgramDayIdsForWeek(programInstanceId, weekIndex);
  const skippedDays = [...skippedIds]
    .map((id) => ({
      programDayId: id,
      label: dayById.get(id)?.label ?? "Training day",
    }))
    .sort((a, b) => (dayById.get(a.programDayId)?.sortOrder ?? 0) - (dayById.get(b.programDayId)?.sortOrder ?? 0));

  return {
    weekIndex,
    durationWeeks: instance.program.durationWeeks,
    displayUnit,
    programName: instance.program.name,
    completedSessions,
    skippedDays,
    weekTotalVolumeKg,
    workoutsCompleted: completedSessions.length,
    workoutsSkipped: skippedDays.length,
  };
}

/** Volume display helper for UI */
export function weekVolumeDisplay(kg: number, unit: WeightUnit): number {
  return Math.round(displayFromKg(kg, unit));
}
