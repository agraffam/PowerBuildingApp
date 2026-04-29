import type { WeightUnit as PrismaWeightUnit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  displayFromKg,
  normalizeWeightToKg,
  oneRmToWorkingWeight,
  resolvePlateIncrementForSession,
  roundToIncrement,
  suggestNextWeekLoad,
  type WeightUnit,
} from "@/lib/calculators";
import { effectiveUseBodyweightResolved } from "@/lib/exercise-bodyweight";
import { loadBodyweightOverrideMaps } from "@/lib/bodyweight-override-maps";
import { getBarIncrementLbForUser } from "@/lib/user-exercise-prefs";
import { resolveProgramExercisePrescription } from "@/lib/block-prescription";

function toPreferredUnit(weight: number, fromUnit: WeightUnit, preferred: WeightUnit): number {
  const kg = normalizeWeightToKg(weight, fromUnit);
  return displayFromKg(kg, preferred);
}

/** After %1RM prefill: fill still-empty sets from last completed session, with progression when rules say bump. */
export async function prefillHistoryWeightsForSession(sessionId: string, userId: string) {
  const session = await prisma.workoutSession.findUnique({
    where: { id: sessionId },
    include: { programInstance: true },
  });
  if (!session || session.programInstance.userId !== userId) return;

  const full = await prisma.workoutSession.findUnique({
    where: { id: sessionId },
    include: {
      sets: {
        include: {
          programExercise: { include: { exercise: true } },
        },
      },
    },
  });
  if (!full) return;

  const instCtx = await prisma.programInstance.findUnique({
    where: { id: full.programInstanceId },
    include: { program: { include: { blocks: { orderBy: { sortOrder: "asc" } } } } },
  });
  if (!instCtx) return;

  const bwMaps = await loadBodyweightOverrideMaps(sessionId, full.programInstanceId);

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const preferred: WeightUnit =
    settings?.preferredWeightUnit === "KG" ? "KG" : "LB";
  const plateDefaults = {
    plateIncrementLb: settings?.plateIncrementLb ?? 2.5,
    plateIncrementKg: settings?.plateIncrementKg ?? 2.5,
  };
  const mNow = full.intensityMultiplier ?? 1;

  const byPe = new Map<string, (typeof full.sets)[number][]>();
  for (const row of full.sets) {
    if (!byPe.has(row.programExerciseId)) byPe.set(row.programExerciseId, []);
    byPe.get(row.programExerciseId)!.push(row);
  }
  for (const arr of byPe.values()) arr.sort((a, b) => a.setIndex - b.setIndex);

  for (const rows of byPe.values()) {
    if (rows.length === 0) continue;
    const peId = rows[0]!.programExerciseId;
    const pe = rows[0]!.programExercise;
    if (
      effectiveUseBodyweightResolved(
        { useBodyweight: pe.useBodyweight },
        { isBodyweight: pe.exercise.isBodyweight },
        {
          sessionOverride: bwMaps.sessionByProgramExerciseId.get(peId) ?? null,
          instanceOverride: bwMaps.instanceByProgramExerciseId.get(peId) ?? null,
        },
      )
    ) {
      continue;
    }
    const needFill = rows.some((r) => !r.done && !(r.weight > 0));
    if (!needFill) continue;

    const prevSession = await prisma.workoutSession.findFirst({
      where: {
        id: { not: sessionId },
        status: "COMPLETED",
        programInstance: { userId },
        sets: { some: { programExerciseId: peId, done: true } },
      },
      orderBy: { performedAt: "desc" },
      include: {
        sets: { where: { programExerciseId: peId, done: true }, orderBy: { setIndex: "asc" } },
      },
    });

    const effId = rows[0]!.loggedExerciseId ?? pe.exerciseId;
    const barLb = await getBarIncrementLbForUser(effId, userId, pe.exercise.barIncrementLb);
    const plateInc = resolvePlateIncrementForSession(
      preferred,
      barLb,
      plateDefaults,
    );

    if (!prevSession || prevSession.sets.length === 0) continue;

    const prevSets = prevSession.sets;
    if (prevSets.length === 0) continue;
    const last = prevSets[prevSets.length - 1]!;
    const mPrev = prevSession.intensityMultiplier ?? 1;
    const scale = mPrev > 0 ? mNow / mPrev : 1;
    const wLast =
      toPreferredUnit(last.weight, last.weightUnit as WeightUnit, preferred) * scale;
    const wRounded = roundToIncrement(wLast, plateInc);

    if (pe.exercise.kind === "CARDIO") continue;

    const rx = resolveProgramExercisePrescription({
      programExercise: {
        sets: pe.sets,
        repTarget: pe.repTarget,
        targetRpe: pe.targetRpe,
        pctOf1rm: pe.pctOf1rm,
        restSec: pe.restSec,
        targetDurationSec: pe.targetDurationSec,
        targetCalories: pe.targetCalories,
        loadRole: pe.loadRole,
      },
      exerciseKind: pe.exercise.kind,
      autoBlockPrescriptions: instCtx.program.autoBlockPrescriptions,
      deloadIntervalWeeks: instCtx.program.deloadIntervalWeeks,
      blocks: instCtx.program.blocks,
      instanceWeekIndex: full.weekIndex,
      periodizationStyle:
        (instCtx.program as { periodizationStyle?: "LINEAR" | "ALTERNATING" | "UNDULATING" })
          .periodizationStyle ?? "LINEAR",
    });

    const prog = rx.isDeloadWeek
      ? { bumped: false, suggested: wRounded, bumpPct: 0, bumpBy: 0 }
      : suggestNextWeekLoad({
          currentWeight: wRounded,
          repGoal: rx.repTarget,
          actualReps: last.reps ?? 0,
          prescribedRpe: rx.targetRpe,
          actualRpe: last.rpe,
          plateIncrement: plateInc,
        });

    const uniformWeight = prog.bumped && prog.suggested > 0 ? prog.suggested : null;
    const perIndexWeights =
      uniformWeight == null
        ? rows.map((_, i) => {
            const ps = prevSets[Math.min(i, prevSets.length - 1)]!;
            const wi =
              toPreferredUnit(ps.weight, ps.weightUnit as WeightUnit, preferred) * scale;
            return roundToIncrement(wi, plateInc);
          })
        : null;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!;
      if (r.done || r.weight > 0) continue;
      const w = uniformWeight ?? perIndexWeights![i]!;
      if (!(w > 0)) continue;
      await prisma.loggedSet.update({
        where: { id: r.id },
        data: {
          weight: w,
          weightUnit: preferred as PrismaWeightUnit,
        },
      });
    }
  }
}

/** Copy working weight to other incomplete sets in the same exercise that are still at 0. */
export async function mirrorWorkingWeightToRemainingSets(
  sessionId: string,
  sourceSetId: string,
  userId: string,
) {
  const row = await prisma.loggedSet.findUnique({
    where: { id: sourceSetId },
    include: {
      workoutSession: { include: { programInstance: true } },
      programExercise: { include: { exercise: true } },
    },
  });
  if (!row || row.workoutSession.programInstance.userId !== userId) return;
  if (!row.done) return;
  const sid = row.workoutSessionId;
  const iid = row.workoutSession.programInstanceId;
  const bwMaps = await loadBodyweightOverrideMaps(sid, iid);
  const peId = row.programExerciseId;
  const bw = effectiveUseBodyweightResolved(
    { useBodyweight: row.programExercise.useBodyweight },
    { isBodyweight: row.programExercise.exercise.isBodyweight },
    {
      sessionOverride: bwMaps.sessionByProgramExerciseId.get(peId) ?? null,
      instanceOverride: bwMaps.instanceByProgramExerciseId.get(peId) ?? null,
    },
  );
  if (!bw && !(row.weight > 0)) return;

  await prisma.loggedSet.updateMany({
    where: {
      workoutSessionId: sessionId,
      programExerciseId: row.programExerciseId,
      done: false,
      id: { not: sourceSetId },
      weight: { lte: 0 },
    },
    data: {
      weight: row.weight,
      weightUnit: row.weightUnit,
    },
  });
}

/** Copy source set weight/unit to later unfinished sets in same exercise. */
export async function mirrorSetWeightToFollowingUncompletedSets(
  sessionId: string,
  sourceSetId: string,
  userId: string,
  override?: { weight: number; weightUnit: PrismaWeightUnit } | null,
) {
  const row = await prisma.loggedSet.findUnique({
    where: { id: sourceSetId },
    include: {
      workoutSession: { include: { programInstance: true } },
      programExercise: { include: { exercise: true } },
    },
  });
  if (!row || row.workoutSession.programInstance.userId !== userId) return;
  if (!(row.weight > 0)) return;
  const sid = row.workoutSessionId;
  const iid = row.workoutSession.programInstanceId;
  const peId = row.programExerciseId;
  const bwMaps = await loadBodyweightOverrideMaps(sid, iid);
  const bw = effectiveUseBodyweightResolved(
    { useBodyweight: row.programExercise.useBodyweight },
    { isBodyweight: row.programExercise.exercise.isBodyweight },
    {
      sessionOverride: bwMaps.sessionByProgramExerciseId.get(peId) ?? null,
      instanceOverride: bwMaps.instanceByProgramExerciseId.get(peId) ?? null,
    },
  );
  if (bw) return;

  await prisma.loggedSet.updateMany({
    where: {
      workoutSessionId: sessionId,
      programExerciseId: row.programExerciseId,
      done: false,
      setIndex: { gt: row.setIndex },
    },
    data: {
      weight: override?.weight ?? row.weight,
      weightUnit: override?.weightUnit ?? row.weightUnit,
    },
  });
}

/** Copy source set reps/rpe to later unfinished sets in same exercise. */
export async function mirrorSetRpeRepsToFollowingUncompletedSets(
  sessionId: string,
  sourceSetId: string,
  userId: string,
) {
  const row = await prisma.loggedSet.findUnique({
    where: { id: sourceSetId },
    include: {
      workoutSession: { include: { programInstance: true } },
      programExercise: { include: { exercise: true } },
    },
  });
  if (!row || row.workoutSession.programInstance.userId !== userId) return;

  const sid = row.workoutSessionId;
  const iid = row.workoutSession.programInstanceId;
  const peId = row.programExerciseId;
  const bwMaps = await loadBodyweightOverrideMaps(sid, iid);
  const bw = effectiveUseBodyweightResolved(
    { useBodyweight: row.programExercise.useBodyweight },
    { isBodyweight: row.programExercise.exercise.isBodyweight },
    {
      sessionOverride: bwMaps.sessionByProgramExerciseId.get(peId) ?? null,
      instanceOverride: bwMaps.instanceByProgramExerciseId.get(peId) ?? null,
    },
  );
  if (bw) return;

  await prisma.loggedSet.updateMany({
    where: {
      workoutSessionId: sessionId,
      programExerciseId: row.programExerciseId,
      done: false,
      setIndex: { gt: row.setIndex },
    },
    data: {
      reps: row.reps,
      rpe: row.rpe,
    },
  });
}

/** Apply %1RM-based weights for sets that are not done yet. Respects session.intensityMultiplier. */
export async function prefillPctWeightsForSession(sessionId: string, userId: string) {
  const session = await prisma.workoutSession.findUnique({
    where: { id: sessionId },
    include: {
      programInstance: true,
      sets: {
        include: {
          programExercise: {
            include: {
              exercise: {
                include: {
                  userStrengthProfiles: { where: { userId } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!session || session.programInstance.userId !== userId) return;

  const bwMaps = await loadBodyweightOverrideMaps(sessionId, session.programInstanceId);

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const preferred: WeightUnit =
    settings?.preferredWeightUnit === "KG" ? "KG" : "LB";
  const plateDefaults = {
    plateIncrementLb: settings?.plateIncrementLb ?? 2.5,
    plateIncrementKg: settings?.plateIncrementKg ?? 2.5,
  };
  const m = session.intensityMultiplier ?? 1;

  const pctInst = await prisma.programInstance.findUnique({
    where: { id: session.programInstanceId },
    include: { program: { include: { blocks: { orderBy: { sortOrder: "asc" } } } } },
  });
  if (!pctInst) return;

  for (const row of session.sets) {
    if (row.done) continue;
    const pe = row.programExercise;
    if (
      effectiveUseBodyweightResolved(
        { useBodyweight: pe.useBodyweight },
        { isBodyweight: pe.exercise.isBodyweight },
        {
          sessionOverride: bwMaps.sessionByProgramExerciseId.get(pe.id) ?? null,
          instanceOverride: bwMaps.instanceByProgramExerciseId.get(pe.id) ?? null,
        },
      )
    ) {
      continue;
    }
    const rxPct = resolveProgramExercisePrescription({
      programExercise: {
        sets: pe.sets,
        repTarget: pe.repTarget,
        targetRpe: pe.targetRpe,
        pctOf1rm: pe.pctOf1rm,
        restSec: pe.restSec,
        targetDurationSec: pe.targetDurationSec,
        targetCalories: pe.targetCalories,
        loadRole: pe.loadRole,
      },
      exerciseKind: pe.exercise.kind,
      autoBlockPrescriptions: pctInst.program.autoBlockPrescriptions,
      deloadIntervalWeeks: pctInst.program.deloadIntervalWeeks,
      blocks: pctInst.program.blocks,
      instanceWeekIndex: session.weekIndex,
      periodizationStyle:
        (pctInst.program as { periodizationStyle?: "LINEAR" | "ALTERNATING" | "UNDULATING" })
          .periodizationStyle ?? "LINEAR",
    });
    const pct = rxPct.pctOf1rm;
    const effId = row.loggedExerciseId ?? pe.exerciseId;
    const profile =
      effId === pe.exerciseId
        ? (pe.exercise.userStrengthProfiles[0] ?? null)
        : await prisma.userStrengthProfile.findUnique({
            where: { userId_exerciseId: { userId, exerciseId: effId } },
          });
    if (pct == null || profile == null || !(profile.estimatedOneRm > 0)) continue;

    const exForBar =
      effId === pe.exerciseId ? pe.exercise : await prisma.exercise.findUnique({ where: { id: effId } });
    if (!exForBar) continue;
    const barLb = await getBarIncrementLbForUser(effId, userId, exForBar.barIncrementLb);
    const plateIncrement = resolvePlateIncrementForSession(
      preferred,
      barLb,
      plateDefaults,
    );

    const unit = profile.weightUnit as WeightUnit;
    const e1Kg = normalizeWeightToKg(profile.estimatedOneRm, unit);
    const e1Preferred = displayFromKg(e1Kg, preferred);
    const effective1Rm = e1Preferred * m;
    const w = oneRmToWorkingWeight(effective1Rm, pct, preferred, plateIncrement);

    await prisma.loggedSet.update({
      where: { id: row.id },
      data: {
        weight: w,
        weightUnit: preferred as PrismaWeightUnit,
      },
    });
  }
}
