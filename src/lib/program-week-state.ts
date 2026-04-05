import { prisma } from "@/lib/prisma";

export type ProgramInstanceWithDays = {
  id: string;
  userId: string;
  status: string;
  weekIndex: number;
  nextDaySortOrder: number;
  program: {
    durationWeeks: number;
    days: { id: string; sortOrder: number }[];
  };
};

export async function loadInstanceForWeekState(instanceId: string, userId: string) {
  return prisma.programInstance.findFirst({
    where: { id: instanceId, userId },
    include: {
      program: {
        select: {
          durationWeeks: true,
          days: { select: { id: true, sortOrder: true, label: true } },
        },
      },
    },
  });
}

export async function getCompletedProgramDayIdsForWeek(
  programInstanceId: string,
  weekIndex: number,
): Promise<Set<string>> {
  const rows = await prisma.workoutSession.findMany({
    where: {
      programInstanceId,
      status: "COMPLETED",
      weekIndex,
    },
    select: { programDayId: true },
  });
  return new Set(rows.map((r) => r.programDayId));
}

export async function getSkippedProgramDayIdsForWeek(
  programInstanceId: string,
  weekIndex: number,
): Promise<Set<string>> {
  const rows = await prisma.programInstanceSkippedDay.findMany({
    where: { programInstanceId, weekIndex },
    select: { programDayId: true },
  });
  return new Set(rows.map((r) => r.programDayId));
}

export function sortedProgramDays(instance: ProgramInstanceWithDays) {
  return [...instance.program.days].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Every template day is either completed (this week) or explicitly skipped. */
export function isWeekFullyAccounted(
  daysSorted: { id: string }[],
  completedIds: Set<string>,
  skippedIds: Set<string>,
): boolean {
  if (daysSorted.length === 0) return false;
  return daysSorted.every((d) => completedIds.has(d.id) || skippedIds.has(d.id));
}

/** Index in sorted days array for the next day that still needs a workout or skip-finalize. */
export function firstOpenDayIndex(
  daysSorted: { id: string }[],
  completedIds: Set<string>,
  skippedIds: Set<string>,
): number {
  const idx = daysSorted.findIndex((d) => !completedIds.has(d.id) && !skippedIds.has(d.id));
  return idx;
}

/**
 * Recompute `nextDaySortOrder` (index into sorted days). When the week is fully accounted for,
 * does not advance the calendar week — user must finalize on Train.
 */
export async function syncProgramInstanceCursor(instanceId: string, userId: string) {
  const instance = await prisma.programInstance.findFirst({
    where: { id: instanceId, userId, status: "ACTIVE" },
    include: {
      program: {
        select: {
          durationWeeks: true,
          days: { select: { id: true, sortOrder: true, label: true } },
        },
      },
    },
  });
  if (!instance) return { weekFullyAccounted: false };

  const daysSorted = sortedProgramDays(instance);
  if (daysSorted.length === 0) return { weekFullyAccounted: false };

  const completedIds = await getCompletedProgramDayIdsForWeek(instance.id, instance.weekIndex);
  const skippedIds = await getSkippedProgramDayIdsForWeek(instance.id, instance.weekIndex);
  const full = isWeekFullyAccounted(daysSorted, completedIds, skippedIds);

  if (full) {
    await prisma.programInstance.update({
      where: { id: instanceId },
      data: { nextDaySortOrder: 0 },
    });
    return { weekFullyAccounted: true };
  }

  const openIdx = firstOpenDayIndex(daysSorted, completedIds, skippedIds);
  const nextIdx = openIdx < 0 ? 0 : openIdx;
  await prisma.programInstance.update({
    where: { id: instanceId },
    data: { nextDaySortOrder: nextIdx },
  });
  return { weekFullyAccounted: false };
}

export async function finalizeProgramWeek(instanceId: string, userId: string) {
  const instance = await prisma.programInstance.findFirst({
    where: { id: instanceId, userId, status: "ACTIVE" },
    include: {
      program: { select: { durationWeeks: true, days: { select: { id: true, sortOrder: true } } } },
    },
  });
  if (!instance) {
    return { ok: false as const, error: "NOT_FOUND" };
  }

  const daysSorted = sortedProgramDays(instance);
  const completedIds = await getCompletedProgramDayIdsForWeek(instance.id, instance.weekIndex);
  const skippedIds = await getSkippedProgramDayIdsForWeek(instance.id, instance.weekIndex);
  if (!isWeekFullyAccounted(daysSorted, completedIds, skippedIds)) {
    return { ok: false as const, error: "WEEK_INCOMPLETE" };
  }

  const durationWeeks = instance.program.durationWeeks;
  const nextWeek = instance.weekIndex + 1;

  if (nextWeek >= durationWeeks) {
    await prisma.programInstance.update({
      where: { id: instanceId },
      data: {
        status: "COMPLETED",
        weekIndex: durationWeeks,
        nextDaySortOrder: 0,
      },
    });
    return { ok: true as const, programCompleted: true };
  }

  await prisma.programInstance.update({
    where: { id: instanceId },
    data: {
      weekIndex: nextWeek,
      nextDaySortOrder: 0,
    },
  });
  await syncProgramInstanceCursor(instanceId, userId);
  return { ok: true as const, programCompleted: false };
}
