import type { WeightUnit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { brzyckiOneRm, displayFromKg, KG_PER_LB, normalizeWeightToKg } from "@/lib/calculators";
import { getSkippedProgramDayIdsForWeek } from "@/lib/program-week-state";

export type WeekPrEntry = {
  exerciseName: string;
  /** e.g. "225 lb × 5" */
  detail: string;
};

export type WeekCompletionSummaryPayload = {
  weekIndex: number;
  durationWeeks: number;
  programId: string;
  displayUnit: WeightUnit;
  programName: string;
  prs: WeekPrEntry[];
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

function brzyckiEst1RmKg(weight: number, reps: number, unit: WeightUnit): number | null {
  const e = brzyckiOneRm(weight, reps);
  if (e == null) return null;
  return unit === "LB" ? e * KG_PER_LB : e;
}

async function computeWeekPrs(
  userId: string,
  weekSessionIds: string[],
  displayUnit: WeightUnit,
): Promise<WeekPrEntry[]> {
  if (weekSessionIds.length === 0) return [];

  const weekSets = await prisma.loggedSet.findMany({
    where: {
      workoutSessionId: { in: weekSessionIds },
      done: true,
      weight: { gt: 0 },
      reps: { gt: 0 },
    },
    include: {
      programExercise: { include: { exercise: { select: { id: true, name: true, kind: true } } } },
      loggedExercise: { select: { id: true, name: true, kind: true } },
    },
  });

  type Cand = {
    exId: string;
    name: string;
    weight: number;
    reps: number;
    unit: WeightUnit;
    eKg: number;
  };

  const candidates: Cand[] = [];
  for (const row of weekSets) {
    const kind = row.loggedExercise?.kind ?? row.programExercise.exercise.kind;
    if (kind !== "STRENGTH") continue;
    const exId = row.loggedExerciseId ?? row.programExercise.exerciseId;
    const name = row.loggedExercise?.name ?? row.programExercise.exercise.name;
    const unit = row.weightUnit as WeightUnit;
    const reps = row.reps!;
    const eKg = brzyckiEst1RmKg(row.weight, reps, unit);
    if (eKg == null) continue;
    candidates.push({ exId, name, weight: row.weight, reps, unit, eKg });
  }

  const bestByEx = new Map<string, Cand>();
  for (const c of candidates) {
    const prev = bestByEx.get(c.exId);
    if (!prev || c.eKg > prev.eKg) bestByEx.set(c.exId, c);
  }

  const exIds = [...bestByEx.keys()];
  if (exIds.length === 0) return [];

  const priorSets = await prisma.loggedSet.findMany({
    where: {
      done: true,
      weight: { gt: 0 },
      reps: { gt: 0 },
      workoutSessionId: { notIn: weekSessionIds },
      workoutSession: {
        status: "COMPLETED",
        programInstance: { userId },
      },
      OR: [
        { loggedExerciseId: { in: exIds } },
        { loggedExerciseId: null, programExercise: { exerciseId: { in: exIds } } },
      ],
    },
    select: {
      weight: true,
      weightUnit: true,
      reps: true,
      loggedExerciseId: true,
      programExercise: { select: { exerciseId: true } },
    },
  });

  const priorMaxKg = new Map<string, number>();
  for (const row of priorSets) {
    const pid = row.loggedExerciseId ?? row.programExercise.exerciseId;
    if (!exIds.includes(pid)) continue;
    const unit = row.weightUnit as WeightUnit;
    const reps = row.reps!;
    const eKg = brzyckiEst1RmKg(row.weight, reps, unit);
    if (eKg == null) continue;
    priorMaxKg.set(pid, Math.max(priorMaxKg.get(pid) ?? 0, eKg));
  }

  const unitLabel = displayUnit === "KG" ? "kg" : "lb";
  const prs: WeekPrEntry[] = [];
  for (const c of bestByEx.values()) {
    const prior = priorMaxKg.get(c.exId) ?? 0;
    if (c.eKg > prior) {
      const kg = normalizeWeightToKg(c.weight, c.unit);
      const wDisplay = displayFromKg(kg, displayUnit);
      const wRounded = Math.round(wDisplay * 10) / 10;
      prs.push({
        exerciseName: c.name,
        detail: `${wRounded} ${unitLabel} × ${c.reps}`,
      });
    }
  }

  prs.sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
  return prs;
}

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
      const reps = row.reps ?? pe.repTarget ?? 0;
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

  const weekSessionIds = sessions.map((s) => s.id);
  const prs = await computeWeekPrs(userId, weekSessionIds, displayUnit);

  return {
    weekIndex,
    durationWeeks: instance.program.durationWeeks,
    programId: instance.programId,
    displayUnit,
    programName: instance.program.name,
    prs,
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
