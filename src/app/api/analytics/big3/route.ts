import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { brzyckiOneRm, displayFromKg, normalizeWeightToKg } from "@/lib/calculators";
import type { WeightUnit } from "@prisma/client";
import { startOfWeek, format } from "date-fns";
import { requireUserId } from "@/lib/auth/require-user";

const BIG3_SLUGS = ["squat", "bench-press", "deadlift"] as const;

export async function GET(req: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { preferredWeightUnit: true },
  });
  const displayUnit: WeightUnit = settings?.preferredWeightUnit ?? "LB";
  const allStrength = await prisma.exercise.findMany({
    where: { kind: "STRENGTH", isBodyweight: false },
    select: { id: true, slug: true, name: true },
    orderBy: { name: "asc" },
  });
  const exById = new Map(allStrength.map((e) => [e.id, e]));
  const qIds = new URL(req.url).searchParams.get("exerciseIds");
  const requestedIds = (qIds ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const fallback = BIG3_SLUGS
    .map((slug) => allStrength.find((e) => e.slug === slug)?.id)
    .filter((v): v is string => Boolean(v));
  const selectedExerciseIds = (requestedIds.length > 0 ? requestedIds : fallback).filter((id) => exById.has(id));
  if (selectedExerciseIds.length === 0) {
    return NextResponse.json({ displayUnit, availableExercises: allStrength, series: [] });
  }

  type WeekPoint = { week: string; volumeKg: number; bestE1rmKg: number; sessions: number };

  const weekly = new Map<string, Map<string, WeekPoint>>();

  for (const id of selectedExerciseIds) {
    weekly.set(id, new Map());
  }

  const sets = await prisma.loggedSet.findMany({
    where: {
      done: true,
      reps: { gt: 0 },
      weight: { gt: 0 },
      OR: [
        { loggedExerciseId: { in: selectedExerciseIds } },
        { programExercise: { exerciseId: { in: selectedExerciseIds } } },
      ],
      workoutSession: {
        status: "COMPLETED",
        programInstance: { userId },
      },
    },
    include: {
      workoutSession: true,
      programExercise: { include: { exercise: true } },
    },
    orderBy: { completedAt: "asc" },
  });

  for (const s of sets) {
    const exerciseId = s.loggedExerciseId ?? s.programExercise.exerciseId;
    if (!selectedExerciseIds.includes(exerciseId)) continue;
    const performed = s.completedAt ?? s.workoutSession.performedAt;
    const weekStart = startOfWeek(performed, { weekStartsOn: 1 });
    const weekKey = format(weekStart, "yyyy-MM-dd");
    const m = weekly.get(exerciseId)!;
    if (!m.has(weekKey)) {
      m.set(weekKey, { week: weekKey, volumeKg: 0, bestE1rmKg: 0, sessions: 0 });
    }
    const pt = m.get(weekKey)!;
    const kg = normalizeWeightToKg(s.weight, s.weightUnit as WeightUnit);
    pt.volumeKg += kg * (s.reps ?? 0);
    const e1 = brzyckiOneRm(s.weight, s.reps ?? 0);
    if (e1) {
      const e1Kg = normalizeWeightToKg(e1, s.weightUnit as WeightUnit);
      pt.bestE1rmKg = Math.max(pt.bestE1rmKg, e1Kg);
    }
  }

  const profiles = await prisma.userStrengthProfile.findMany({
    where: { userId, exerciseId: { in: selectedExerciseIds } },
    select: { exerciseId: true, estimatedOneRm: true, weightUnit: true },
  });
  const profileByExerciseId = new Map(profiles.map((p) => [p.exerciseId, p]));

  const result = selectedExerciseIds.map((exerciseId) => {
    const m = weekly.get(exerciseId)!;
    const points = [...m.values()].sort((a, b) => a.week.localeCompare(b.week));
    const lastBestE1rmKg = points.length > 0 ? points[points.length - 1]!.bestE1rmKg : 0;
    const profile = profileByExerciseId.get(exerciseId);
    const currentEstimatedOneRmDisplay = profile
      ? displayFromKg(normalizeWeightToKg(profile.estimatedOneRm, profile.weightUnit as WeightUnit), displayUnit)
      : lastBestE1rmKg > 0
        ? displayFromKg(lastBestE1rmKg, displayUnit)
        : null;
    return {
      exerciseId,
      slug: exById.get(exerciseId)?.slug ?? exerciseId,
      label: exById.get(exerciseId)?.name ?? exerciseId,
      currentEstimatedOneRmDisplay: currentEstimatedOneRmDisplay != null ? Math.round(currentEstimatedOneRmDisplay * 10) / 10 : null,
      points: points.map((p) => ({
        week: p.week,
        volume: Math.round(displayFromKg(p.volumeKg, displayUnit) * 10) / 10,
        bestE1rm: Math.round(displayFromKg(p.bestE1rmKg, displayUnit) * 10) / 10,
      })),
    };
  });

  return NextResponse.json({
    displayUnit,
    availableExercises: allStrength,
    series: result,
  });
}
