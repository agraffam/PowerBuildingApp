import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, type WeightUnit } from "@prisma/client";
import {
  prefillHistoryWeightsForSession,
  prefillPctWeightsForSession,
} from "@/lib/prefill-session-weights";
import { requireUserId } from "@/lib/auth/require-user";
import { getValidatedPlannedOrder, parsePlanOrderMap } from "@/lib/planned-exercise-order";
import {
  getCompletedProgramDayIdsForWeek,
  getSkippedProgramDayIdsForWeek,
  isWeekFullyAccounted,
  sortedProgramDays,
} from "@/lib/program-week-state";
import { resolveProgramExercisePrescription } from "@/lib/block-prescription";

export async function POST(req: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  let programDayId: string | undefined;
  try {
    const raw = await req.json().catch(() => ({}));
    if (raw && typeof raw === "object" && "programDayId" in raw) {
      const v = (raw as { programDayId?: unknown }).programDayId;
      if (typeof v === "string" && v.trim()) programDayId = v.trim();
    }
  } catch {
    /* empty body */
  }

  const instance = await prisma.programInstance.findFirst({
    where: { status: "ACTIVE", userId },
    include: {
      program: {
        include: {
          days: { orderBy: { sortOrder: "asc" } },
          blocks: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  if (!instance) {
    return NextResponse.json({ error: "No active program" }, { status: 400 });
  }

  const daysSorted = sortedProgramDays(instance);
  const completedIds = await getCompletedProgramDayIdsForWeek(instance.id, instance.weekIndex);
  const skippedIds = await getSkippedProgramDayIdsForWeek(instance.id, instance.weekIndex);
  if (isWeekFullyAccounted(daysSorted, completedIds, skippedIds)) {
    return NextResponse.json(
      { error: "Review and advance your week on Train before starting new workouts." },
      { status: 409 },
    );
  }

  const existing = await prisma.workoutSession.findFirst({
    where: {
      programInstanceId: instance.id,
      status: { in: ["PLANNED", "IN_PROGRESS"] },
    },
  });
  if (existing) {
    return NextResponse.json({ sessionId: existing.id });
  }

  const days = [...instance.program.days].sort((a, b) => a.sortOrder - b.sortOrder);
  let day = days[instance.nextDaySortOrder] ?? null;
  if (programDayId != null) {
    const picked = days.find((d) => d.id === programDayId);
    if (!picked) {
      return NextResponse.json({ error: "Invalid training day" }, { status: 400 });
    }
    day = picked;
  }
  if (!day) {
    return NextResponse.json({ error: "Invalid program day cursor" }, { status: 400 });
  }

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const unit: WeightUnit = settings?.preferredWeightUnit ?? "LB";

  const exercises = await prisma.programExercise.findMany({
    where: { programDayId: day.id },
    orderBy: { sortOrder: "asc" },
    include: { exercise: { select: { kind: true } } },
  });

  const replacements = await prisma.programInstanceExerciseReplacement.findMany({
    where: { programInstanceId: instance.id },
  });
  const repMap = new Map(replacements.map((r) => [r.programExerciseId, r.replacementExerciseId]));

  const planMap = parsePlanOrderMap(instance.plannedExerciseOrderByDay);
  const exerciseOrder = getValidatedPlannedOrder(
    day.id,
    exercises.map((e) => e.id),
    planMap,
  );

  let planData: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined;
  if (planMap && Object.prototype.hasOwnProperty.call(planMap, day.id)) {
    const next = { ...planMap };
    delete next[day.id];
    planData = Object.keys(next).length > 0 ? next : Prisma.JsonNull;
  }

  const session = await prisma.$transaction(async (tx) => {
    const ws = await tx.workoutSession.create({
      data: {
        programInstanceId: instance.id,
        programDayId: day.id,
        weekIndex: instance.weekIndex,
        status: "PLANNED",
        intensityMultiplier: 1,
        ...(exerciseOrder ? { exerciseOrder } : {}),
        sets: {
          create: exercises.flatMap((pe) => {
            const alt = repMap.get(pe.id);
            const loggedExerciseId =
              alt != null && alt !== pe.exerciseId ? alt : undefined;
            const cardio = pe.exercise.kind === "CARDIO";
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
              autoBlockPrescriptions: instance.program.autoBlockPrescriptions,
              deloadIntervalWeeks: instance.program.deloadIntervalWeeks,
              blocks: instance.program.blocks,
              instanceWeekIndex: instance.weekIndex,
            });
            const nSets = rx.sets;
            return Array.from({ length: nSets }, (_, setIndex) => ({
              programExerciseId: pe.id,
              loggedExerciseId,
              setIndex,
              weight: 0,
              weightUnit: unit,
              reps: cardio ? null : rx.repTarget,
              rpe: cardio ? null : rx.targetRpe,
              durationSec: cardio ? rx.targetDurationSec : null,
              calories: cardio ? rx.targetCalories ?? null : null,
              done: false,
            }));
          }),
        },
      },
    });
    if (planData !== undefined) {
      await tx.programInstance.update({
        where: { id: instance.id },
        data: { plannedExerciseOrderByDay: planData },
      });
    }
    return ws;
  });

  await prefillPctWeightsForSession(session.id, userId);
  await prefillHistoryWeightsForSession(session.id, userId);

  return NextResponse.json({ sessionId: session.id });
}
