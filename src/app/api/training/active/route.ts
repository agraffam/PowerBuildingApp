import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/require-user";
import { getBarIncrementLbForUser } from "@/lib/user-exercise-prefs";
import { enrichProgramDaysWithInstanceReplacements } from "@/lib/exercise-swaps";
import { getValidatedPlannedOrder, parsePlanOrderMap } from "@/lib/planned-exercise-order";
import {
  getCompletedProgramDayIdsForWeek,
  getSkippedProgramDayIdsForWeek,
  isWeekFullyAccounted,
  sortedProgramDays,
} from "@/lib/program-week-state";
import { buildWeekCompletionSummary } from "@/lib/week-completion-summary";
import { getAppVersionTicker } from "@/lib/app-version";
import { resolveProgramExercisePrescription } from "@/lib/block-prescription";

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
            blocks: { orderBy: { sortOrder: "asc" } },
            days: {
              orderBy: { sortOrder: "asc" },
              include: {
                exercises: {
                  orderBy: { sortOrder: "asc" },
                  include: {
                    exercise: {
                      select: {
                        id: true,
                        name: true,
                        slug: true,
                        barIncrementLb: true,
                        muscleTags: true,
                        kind: true,
                      },
                    },
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

    const planMap = parsePlanOrderMap(instance.plannedExerciseOrderByDay);
    const daysOrdered = daysWithSwaps.map((day) => {
      const order = getValidatedPlannedOrder(
        day.id,
        day.exercises.map((e) => e.id),
        planMap,
      );
      if (!order) return day;
      const byId = new Map(day.exercises.map((e) => [e.id, e]));
      return {
        ...day,
        exercises: order.map((id) => byId.get(id)!),
      };
    });
    const daysWithResolvedPreview = daysOrdered.map((day) => ({
      ...day,
      exercises: day.exercises.map((ex) => {
        const rx = resolveProgramExercisePrescription({
          programExercise: {
            sets: ex.sets,
            repTarget: ex.repTarget,
            targetRpe: ex.targetRpe,
            pctOf1rm: ex.pctOf1rm,
            restSec: ex.restSec,
            targetDurationSec: ex.targetDurationSec,
            targetCalories: ex.targetCalories,
            loadRole: ex.loadRole,
          },
          exerciseKind: ex.exercise.kind,
          autoBlockPrescriptions: instance.program.autoBlockPrescriptions,
          deloadIntervalWeeks: instance.program.deloadIntervalWeeks,
          blocks: instance.program.blocks,
          instanceWeekIndex: instance.weekIndex,
          periodizationStyle:
            (instance.program as { periodizationStyle?: "LINEAR" | "ALTERNATING" | "UNDULATING" })
              .periodizationStyle ?? "LINEAR",
        });
        return {
          ...ex,
          sets: rx.sets,
          repTarget: rx.repTarget,
          targetRpe: rx.targetRpe,
          pctOf1rm: rx.pctOf1rm,
        };
      }),
    }));

    const nextDay = daysWithResolvedPreview[instance.nextDaySortOrder] ?? null;

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

    const daysSortedForWeek = sortedProgramDays(instance);
    const completedSet = await getCompletedProgramDayIdsForWeek(instance.id, instance.weekIndex);
    const skippedSet = await getSkippedProgramDayIdsForWeek(instance.id, instance.weekIndex);
    const skippedDayIdsThisWeek = [...skippedSet];
    const weekPendingFinalize = isWeekFullyAccounted(daysSortedForWeek, completedSet, skippedSet);

    let weekSummary: Awaited<ReturnType<typeof buildWeekCompletionSummary>> | null = null;
    if (weekPendingFinalize) {
      weekSummary = await buildWeekCompletionSummary(userId, instance.id, instance.weekIndex);
    }

    const instanceOut = {
      ...instance,
      program: { ...instance.program, days: daysWithResolvedPreview },
    };

    return NextResponse.json(
      {
        appVersion: getAppVersionTicker(),
        instance: instanceOut,
        nextDay: weekPendingFinalize ? null : nextDay,
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
        skippedDayIdsThisWeek,
        weekPendingFinalize,
        weekSummary,
      },
      noStoreJson,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { ...noStoreJson, status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const body = (await req.json().catch(() => null)) as {
    action?: string;
    programDayId?: string;
    programExerciseIds?: unknown;
  } | null;
  if (!body || body.action !== "setPlannedOrder") {
    return NextResponse.json({ error: "Invalid body" }, { ...noStoreJson, status: 400 });
  }
  const programDayId = typeof body.programDayId === "string" ? body.programDayId.trim() : "";
  const ids = Array.isArray(body.programExerciseIds)
    ? body.programExerciseIds.filter((x): x is string => typeof x === "string")
    : [];
  if (!programDayId || ids.length === 0) {
    return NextResponse.json(
      { error: "programDayId and programExerciseIds required" },
      { ...noStoreJson, status: 400 },
    );
  }

  const instance = await prisma.programInstance.findFirst({
    where: { status: "ACTIVE", userId },
    include: {
      program: { include: { days: { include: { exercises: { select: { id: true } } } } } },
    },
  });
  if (!instance) {
    return NextResponse.json({ error: "No active program" }, { ...noStoreJson, status: 400 });
  }

  const day = instance.program.days.find((d) => d.id === programDayId);
  if (!day) {
    return NextResponse.json({ error: "Invalid training day" }, { ...noStoreJson, status: 400 });
  }

  const expected = new Set(day.exercises.map((e) => e.id));
  if (ids.length !== expected.size || ids.some((id) => !expected.has(id))) {
    return NextResponse.json({ error: "Invalid exercise order" }, { ...noStoreJson, status: 400 });
  }

  const parsed = parsePlanOrderMap(instance.plannedExerciseOrderByDay) ?? {};
  const next = { ...parsed, [programDayId]: ids };

  await prisma.programInstance.update({
    where: { id: instance.id },
    data: { plannedExerciseOrderByDay: next },
  });

  return NextResponse.json({ ok: true }, noStoreJson);
}
