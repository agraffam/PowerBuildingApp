import { prisma } from "@/lib/prisma";

/** Advance cursor after completing or skipping a template day. */
export async function advanceProgramInstance(instanceId: string, userId: string) {
  const instance = await prisma.programInstance.findUnique({
    where: { id: instanceId },
    include: { program: { select: { durationWeeks: true, days: true } } },
  });
  if (!instance || instance.userId !== userId || instance.status === "COMPLETED") return;

  const nDays = instance.program.days.length;
  if (nDays === 0) return;

  let nextOrder = instance.nextDaySortOrder + 1;
  let week = instance.weekIndex;
  if (nextOrder >= nDays) {
    nextOrder = 0;
    week += 1;
  }

  const completed = week >= instance.program.durationWeeks;

  await prisma.programInstance.update({
    where: { id: instanceId },
    data: {
      nextDaySortOrder: completed ? 0 : nextOrder,
      weekIndex: completed ? instance.program.durationWeeks : week,
      status: completed ? "COMPLETED" : "ACTIVE",
    },
  });
}
