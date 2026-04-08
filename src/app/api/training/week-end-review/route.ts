import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/require-user";
import { getSkippedProgramDayIdsForWeek } from "@/lib/program-week-state";
import { normalizeWeightToKg, displayFromKg } from "@/lib/calculators";

export async function GET() {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const activeInstance = await prisma.programInstance.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { startedAt: "desc" },
    include: {
      program: {
        select: {
          name: true,
          days: { select: { id: true } },
        },
      },
    },
  });
  if (!activeInstance) {
    return NextResponse.json({
      review: null,
    });
  }

  const weekIndex = activeInstance.weekIndex;
  const sessions = await prisma.workoutSession.findMany({
    where: {
      programInstanceId: activeInstance.id,
      weekIndex,
      status: "COMPLETED",
    },
    include: {
      sets: true,
      programDay: {
        include: {
          exercises: { select: { id: true, repTarget: true } },
        },
      },
    },
  });

  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { preferredWeightUnit: true },
  });
  const displayUnit = settings?.preferredWeightUnit ?? "LB";

  let totalVolumeKg = 0;
  let bestTopSet: { label: string; score: number } | null = null;
  for (const s of sessions) {
    const peById = new Map(s.programDay.exercises.map((pe) => [pe.id, pe]));
    for (const set of s.sets) {
      if (!set.done) continue;
      const reps = set.reps ?? peById.get(set.programExerciseId)?.repTarget ?? 0;
      if (reps <= 0) continue;
      const setVolumeKg = normalizeWeightToKg(set.weight, set.weightUnit) * reps;
      totalVolumeKg += setVolumeKg;
      const score = set.weight * reps;
      if (!bestTopSet || score > bestTopSet.score) {
        bestTopSet = {
          score,
          label: `${set.weight} ${set.weightUnit} x ${reps}${set.rpe != null ? ` @ ${set.rpe} RPE` : ""}`,
        };
      }
    }
  }

  const skipped = await getSkippedProgramDayIdsForWeek(activeInstance.id, weekIndex);
  const completedDayIds = new Set(sessions.map((s) => s.programDayId));
  const daysInWeek = activeInstance.program.days.length;
  const accounted = new Set([...completedDayIds, ...skipped]).size;
  const adherenceRate = daysInWeek > 0 ? accounted / daysInWeek : 0;

  return NextResponse.json({
    review: {
      programName: activeInstance.program.name,
      weekIndex,
      sessionsCompleted: sessions.length,
      totalVolume: Math.round(displayFromKg(totalVolumeKg, displayUnit)),
      totalVolumeUnit: displayUnit,
      bestTopSet: bestTopSet?.label ?? null,
      adherenceRate,
      daysInWeek,
      accountedDays: accounted,
    },
  });
}
