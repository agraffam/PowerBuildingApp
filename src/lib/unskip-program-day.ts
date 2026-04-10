import { prisma } from "@/lib/prisma";
import {
  getCompletedProgramDayIdsForWeek,
  loadInstanceForWeekState,
  sortedProgramDays,
  syncProgramInstanceCursor,
} from "@/lib/program-week-state";

export async function unskipProgramDayForInstance(
  instanceId: string,
  userId: string,
  programDayId: string,
) {
  const instance = await loadInstanceForWeekState(instanceId, userId);
  if (!instance || instance.status !== "ACTIVE") {
    throw new Error("NOT_FOUND");
  }

  const daysSorted = sortedProgramDays(instance);
  if (!daysSorted.some((d) => d.id === programDayId)) {
    throw new Error("INVALID_DAY");
  }

  const completed = await getCompletedProgramDayIdsForWeek(instanceId, instance.weekIndex);
  if (completed.has(programDayId)) {
    throw new Error("ALREADY_DONE");
  }

  const anyInProgress = await prisma.workoutSession.findFirst({
    where: {
      programInstanceId: instanceId,
      status: "IN_PROGRESS",
    },
  });
  if (anyInProgress) {
    throw new Error("SESSION_IN_PROGRESS");
  }

  const deleted = await prisma.programInstanceSkippedDay.deleteMany({
    where: {
      programInstanceId: instanceId,
      weekIndex: instance.weekIndex,
      programDayId,
    },
  });
  if (deleted.count === 0) {
    throw new Error("NOT_SKIPPED");
  }

  return syncProgramInstanceCursor(instanceId, userId);
}
