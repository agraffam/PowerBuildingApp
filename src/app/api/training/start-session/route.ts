import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { WeightUnit } from "@prisma/client";
import {
  prefillHistoryWeightsForSession,
  prefillPctWeightsForSession,
} from "@/lib/prefill-session-weights";
import { requireUserId } from "@/lib/auth/require-user";

export async function POST() {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const instance = await prisma.programInstance.findFirst({
    where: { status: "ACTIVE", userId },
    include: {
      program: {
        include: {
          days: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  if (!instance) {
    return NextResponse.json({ error: "No active program" }, { status: 400 });
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
  const day = days[instance.nextDaySortOrder];
  if (!day) {
    return NextResponse.json({ error: "Invalid program day cursor" }, { status: 400 });
  }

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const unit: WeightUnit = settings?.preferredWeightUnit ?? "LB";

  const exercises = await prisma.programExercise.findMany({
    where: { programDayId: day.id },
    orderBy: { sortOrder: "asc" },
  });

  const replacements = await prisma.programInstanceExerciseReplacement.findMany({
    where: { programInstanceId: instance.id },
  });
  const repMap = new Map(replacements.map((r) => [r.programExerciseId, r.replacementExerciseId]));

  const session = await prisma.workoutSession.create({
    data: {
      programInstanceId: instance.id,
      programDayId: day.id,
      weekIndex: instance.weekIndex,
      status: "PLANNED",
      intensityMultiplier: 1,
      sets: {
        create: exercises.flatMap((pe) => {
          const alt = repMap.get(pe.id);
          const loggedExerciseId =
            alt != null && alt !== pe.exerciseId ? alt : undefined;
          return Array.from({ length: pe.sets }, (_, setIndex) => ({
            programExerciseId: pe.id,
            loggedExerciseId,
            setIndex,
            weight: 0,
            weightUnit: unit,
            reps: pe.repTarget,
            rpe: pe.targetRpe,
            done: false,
          }));
        }),
      },
    },
  });

  await prefillPctWeightsForSession(session.id, userId);
  await prefillHistoryWeightsForSession(session.id, userId);

  return NextResponse.json({ sessionId: session.id });
}
