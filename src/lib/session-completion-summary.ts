import type { WeightUnit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  displayFromKg,
  estimateOneRmFromSet,
  normalizeWeightToKg,
} from "@/lib/calculators";
import { loadSwapMapsForSession, resolveEffectiveFromMaps } from "@/lib/exercise-swaps";

const PR_RATIO = 1.005;

function roundDisplay(n: number): number {
  return Math.round(n * 10) / 10;
}

export type SessionCompletionSummary = {
  programDayLabel: string;
  weekIndex: number;
  readiness: { sleep: number; stress: number; soreness: number } | null;
  intensityMultiplier: number;
  durationSec: number | null;
  totalVolumeKg: number;
  displayUnit: WeightUnit;
  volumeByExercise: {
    exerciseId: string;
    name: string;
    volumeKg: number;
    topSetLabel: string;
  }[];
  prs: {
    exerciseId: string;
    name: string;
    estimatedOneRmDisplay: number;
    previousOneRmDisplay: number | null;
  }[];
  strengthSuggestions: {
    exerciseId: string;
    name: string;
    suggestedOneRmDisplay: number;
    previousOneRmDisplay: number | null;
    isPr: boolean;
  }[];
  completedWorkoutCount: number;
  workoutStartedAt: string | null;
  workoutCompletedAt: string;
};

function setLabel(weight: number, unit: WeightUnit, reps: number, rpe: number): string {
  return `${roundDisplay(weight)} ${unit} × ${reps} @ ${rpe} RPE`;
}

export async function buildSessionCompletionSummary(
  userId: string,
  sessionId: string,
): Promise<SessionCompletionSummary> {
  const session = await prisma.workoutSession.findUnique({
    where: { id: sessionId },
    include: {
      programDay: { include: { exercises: { include: { exercise: true } } } },
      sets: true,
      programInstance: true,
    },
  });
  if (!session || session.programInstance.userId !== userId) {
    throw new Error("NOT_FOUND");
  }
  if (session.status !== "COMPLETED") {
    throw new Error("BAD_STATE");
  }

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const displayUnit: WeightUnit = settings?.preferredWeightUnit ?? "LB";

  const { sessionMap, instanceMap } = await loadSwapMapsForSession(
    session.id,
    session.programInstanceId,
  );
  const peById = new Map(session.programDay.exercises.map((pe) => [pe.id, pe]));

  const effIdSet = new Set<string>();
  for (const pe of session.programDay.exercises) {
    effIdSet.add(resolveEffectiveFromMaps(pe.id, pe.exerciseId, sessionMap, instanceMap));
  }
  const exercises = await prisma.exercise.findMany({ where: { id: { in: [...effIdSet] } } });
  const nameByEff = new Map(exercises.map((e) => [e.id, e.name]));

  type Agg = { volumeKg: number; bestE1Kg: number; topSetLabel: string };
  const byEff = new Map<string, Agg>();

  for (const row of session.sets) {
    if (!row.done) continue;
    const pe = peById.get(row.programExerciseId);
    if (!pe) continue;
    const effId = resolveEffectiveFromMaps(pe.id, pe.exerciseId, sessionMap, instanceMap);
    const reps = row.reps ?? pe.repTarget ?? 0;
    const rpe = row.rpe ?? pe.targetRpe ?? 8;
    const wu = row.weightUnit as WeightUnit;
    const volKg = normalizeWeightToKg(row.weight, wu) * (reps > 0 ? reps : 0);
    const e1 = estimateOneRmFromSet(row.weight, reps, rpe);

    let agg = byEff.get(effId);
    if (!agg) {
      agg = { volumeKg: 0, bestE1Kg: 0, topSetLabel: "" };
      byEff.set(effId, agg);
    }
    agg.volumeKg += volKg;
    if (e1 != null) {
      const e1Kg = normalizeWeightToKg(e1, wu);
      if (e1Kg > agg.bestE1Kg) {
        agg.bestE1Kg = e1Kg;
        agg.topSetLabel = setLabel(row.weight, wu, reps, rpe);
      }
    }
  }

  const profiles = await prisma.userStrengthProfile.findMany({
    where: { userId, exerciseId: { in: [...effIdSet] } },
  });
  const profileByEx = new Map(profiles.map((p) => [p.exerciseId, p]));

  const prs: SessionCompletionSummary["prs"] = [];
  const strengthSuggestions: SessionCompletionSummary["strengthSuggestions"] = [];

  for (const [effId, agg] of byEff) {
    if (!(agg.bestE1Kg > 0)) continue;
    const name = nameByEff.get(effId) ?? "Exercise";
    const prof = profileByEx.get(effId);
    const prevKg =
      prof != null ? normalizeWeightToKg(prof.estimatedOneRm, prof.weightUnit as WeightUnit) : null;
    const isPr = prevKg == null || agg.bestE1Kg >= prevKg * PR_RATIO;
    const suggestedDisplay = roundDisplay(displayFromKg(agg.bestE1Kg, displayUnit));
    const prevDisplay =
      prevKg != null ? roundDisplay(displayFromKg(prevKg, displayUnit)) : null;

    if (isPr) {
      prs.push({
        exerciseId: effId,
        name,
        estimatedOneRmDisplay: suggestedDisplay,
        previousOneRmDisplay: prevDisplay,
      });
    }
    if (isPr || prevKg == null) {
      strengthSuggestions.push({
        exerciseId: effId,
        name,
        suggestedOneRmDisplay: suggestedDisplay,
        previousOneRmDisplay: prevDisplay,
        isPr,
      });
    }
  }

  const volumeByExercise = [...byEff.entries()]
    .map(([exerciseId, agg]) => ({
      exerciseId,
      name: nameByEff.get(exerciseId) ?? "Exercise",
      volumeKg: agg.volumeKg,
      topSetLabel: agg.topSetLabel,
    }))
    .filter((r) => r.volumeKg > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const totalVolumeKg = volumeByExercise.reduce((s, r) => s + r.volumeKg, 0);

  let durationSec: number | null = null;
  if (session.workoutCompletedAt && session.workoutStartedAt) {
    durationSec = Math.round(
      (session.workoutCompletedAt.getTime() - session.workoutStartedAt.getTime()) / 1000,
    );
  } else if (session.workoutCompletedAt) {
    const doneWithTime = session.sets.filter((s) => s.done && s.completedAt != null);
    if (doneWithTime.length > 0) {
      const times = doneWithTime.map((s) => s.completedAt!.getTime());
      durationSec = Math.round((Math.max(...times) - Math.min(...times)) / 1000);
    }
  }

  const completedWorkoutCount = await prisma.workoutSession.count({
    where: {
      status: "COMPLETED",
      programInstance: { userId },
    },
  });

  const readiness =
    session.sleep != null && session.stress != null && session.soreness != null
      ? { sleep: session.sleep, stress: session.stress, soreness: session.soreness }
      : null;

  return {
    programDayLabel: session.programDay.label,
    weekIndex: session.weekIndex,
    readiness,
    intensityMultiplier: session.intensityMultiplier,
    durationSec,
    totalVolumeKg,
    displayUnit,
    volumeByExercise,
    prs,
    strengthSuggestions,
    completedWorkoutCount,
    workoutStartedAt: session.workoutStartedAt?.toISOString() ?? null,
    workoutCompletedAt: session.workoutCompletedAt?.toISOString() ?? new Date().toISOString(),
  };
}
