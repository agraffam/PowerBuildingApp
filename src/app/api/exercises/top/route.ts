import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { brzyckiOneRm } from "@/lib/calculators";
import type { WeightUnit } from "@prisma/client";
import { requireUserId } from "@/lib/auth/require-user";

export async function GET(req: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const exercise = await prisma.exercise.findUnique({ where: { slug } });
  if (!exercise) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sets = await prisma.loggedSet.findMany({
    where: {
      programExercise: { exerciseId: exercise.id },
      done: true,
      reps: { gt: 0 },
      weight: { gt: 0 },
      workoutSession: { status: "COMPLETED", programInstance: { userId } },
    },
    include: { workoutSession: true },
    orderBy: { completedAt: "desc" },
    take: 80,
  });

  let bestE1rm = 0;
  let bestSet = sets[0] ?? null;
  for (const s of sets) {
    const e = brzyckiOneRm(s.weight, s.reps ?? 0);
    if (e == null) continue;
    const eKg = s.weightUnit === "LB" ? e * 0.45359237 : e;
    if (eKg > bestE1rm) {
      bestE1rm = eKg;
      bestSet = s;
    }
  }

  return NextResponse.json({
    exercise,
    bestSet: bestSet
      ? {
          weight: bestSet.weight,
          weightUnit: bestSet.weightUnit as WeightUnit,
          reps: bestSet.reps,
          rpe: bestSet.rpe,
          performedAt: bestSet.workoutSession.performedAt,
        }
      : null,
    recent: sets.slice(0, 5).map((s) => ({
      weight: s.weight,
      weightUnit: s.weightUnit,
      reps: s.reps,
      rpe: s.rpe,
      performedAt: s.workoutSession.performedAt,
    })),
  });
}
