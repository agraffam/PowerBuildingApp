import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { brzyckiOneRm, normalizeWeightToKg } from "@/lib/calculators";
import type { WeightUnit } from "@prisma/client";
import { startOfWeek, format } from "date-fns";
import { requireUserId } from "@/lib/auth/require-user";

const BIG3_SLUGS = ["squat", "bench-press", "deadlift"] as const;

export async function GET() {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const exercises = await prisma.exercise.findMany({
    where: { slug: { in: [...BIG3_SLUGS] } },
  });

  type WeekPoint = { week: string; volumeKg: number; bestE1rmKg: number; sessions: number };

  const weekly = new Map<string, Map<string, WeekPoint>>();

  for (const slug of BIG3_SLUGS) {
    weekly.set(slug, new Map());
  }

  const sets = await prisma.loggedSet.findMany({
    where: {
      done: true,
      reps: { gt: 0 },
      weight: { gt: 0 },
      programExercise: { exercise: { slug: { in: [...BIG3_SLUGS] } } },
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
    const slug = s.programExercise.exercise.slug;
    if (!BIG3_SLUGS.includes(slug as (typeof BIG3_SLUGS)[number])) continue;
    const performed = s.completedAt ?? s.workoutSession.performedAt;
    const weekStart = startOfWeek(performed, { weekStartsOn: 1 });
    const weekKey = format(weekStart, "yyyy-MM-dd");
    const m = weekly.get(slug)!;
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

  const result = BIG3_SLUGS.map((slug) => {
    const m = weekly.get(slug)!;
    const points = [...m.values()].sort((a, b) => a.week.localeCompare(b.week));
    return { slug, label: exercises.find((e) => e.slug === slug)?.name ?? slug, points };
  });

  return NextResponse.json({ series: result });
}
