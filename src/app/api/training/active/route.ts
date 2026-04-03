import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/require-user";
import { getBarIncrementLbForUser } from "@/lib/user-exercise-prefs";
import { enrichProgramDaysWithInstanceReplacements } from "@/lib/exercise-swaps";

export const dynamic = "force-dynamic";

const noStoreJson = { headers: { "Cache-Control": "private, no-store, max-age=0" } };

export async function GET() {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  try {
    const instance = await prisma.programInstance.findFirst({
      where: { status: "ACTIVE", userId },
      include: {
        program: {
          include: {
            days: {
              orderBy: { sortOrder: "asc" },
              include: {
                exercises: {
                  orderBy: { sortOrder: "asc" },
                  include: {
                    exercise: { select: { id: true, name: true, slug: true, barIncrementLb: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!instance) {
      return NextResponse.json(
        { instance: null, nextDay: null, inProgressSession: null },
        noStoreJson,
      );
    }

    const daysSorted = [...instance.program.days].sort((a, b) => a.sortOrder - b.sortOrder);
    const daysWithSwaps = await enrichProgramDaysWithInstanceReplacements(instance.id, daysSorted);
    for (const day of daysWithSwaps) {
      for (const ex of day.exercises) {
        const bar = await getBarIncrementLbForUser(
          ex.exerciseId,
          userId,
          ex.exercise.barIncrementLb ?? null,
        );
        (ex as { effectiveBarIncrementLb?: number | null }).effectiveBarIncrementLb = bar;
      }
    }

    const nextDay = daysWithSwaps[instance.nextDaySortOrder] ?? null;

    const inProgressSession = await prisma.workoutSession.findFirst({
      where: {
        programInstanceId: instance.id,
        status: { in: ["PLANNED", "IN_PROGRESS"] },
      },
      orderBy: { performedAt: "desc" },
      select: { id: true, programDayId: true },
    });

    const lastCompleted = await prisma.workoutSession.findFirst({
      where: { programInstanceId: instance.id, status: "COMPLETED" },
      orderBy: { performedAt: "desc" },
      include: {
        programDay: { select: { id: true, label: true, sortOrder: true } },
      },
    });

    const completedThisWeek = await prisma.workoutSession.findMany({
      where: {
        programInstanceId: instance.id,
        status: "COMPLETED",
        weekIndex: instance.weekIndex,
      },
      select: { programDayId: true },
    });
    const completedDayIdsThisWeek = [...new Set(completedThisWeek.map((s) => s.programDayId))];

    const instanceOut = {
      ...instance,
      program: { ...instance.program, days: daysWithSwaps },
    };

    return NextResponse.json(
      {
        instance: instanceOut,
        nextDay,
        inProgressSession,
        lastCompleted: lastCompleted
          ? {
              sessionId: lastCompleted.id,
              weekIndex: lastCompleted.weekIndex,
              performedAt: lastCompleted.performedAt.toISOString(),
              dayLabel: lastCompleted.programDay.label,
              daySortOrder: lastCompleted.programDay.sortOrder,
              programDayId: lastCompleted.programDay.id,
            }
          : null,
        completedDayIdsThisWeek,
      },
      noStoreJson,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { ...noStoreJson, status: 500 });
  }
}
