import { prisma } from "@/lib/prisma";
import type { WeightUnit } from "@prisma/client";

export async function getUserSettings(userId: string) {
  return prisma.userSettings.findUnique({ where: { userId } });
}

export async function getActiveProgramInstance(userId: string) {
  return prisma.programInstance.findFirst({
    where: { status: "ACTIVE", userId },
    include: {
      program: {
        include: {
          days: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
}

export async function resolveNextProgramDay(instance: {
  program: { days: { id: string; sortOrder: number }[] };
  nextDaySortOrder: number;
}) {
  const days = [...instance.program.days].sort((a, b) => a.sortOrder - b.sortOrder);
  const day = days[instance.nextDaySortOrder];
  return day ?? null;
}

export async function getSessionDetail(sessionId: string, userId: string) {
  const session = await prisma.workoutSession.findUnique({
    where: { id: sessionId },
    include: {
      programDay: {
        include: {
          exercises: {
            orderBy: { sortOrder: "asc" },
            include: { exercise: true },
          },
        },
      },
      programInstance: { include: { program: true } },
      sets: true,
    },
  });
  if (!session) return null;
  if (session.programInstance.userId !== userId) return null;
  if (session.status === "CANCELLED") return null;

  const settings = await getUserSettings(userId);
  const unit = settings?.preferredWeightUnit ?? "LB";

  const previousByExerciseId = new Map<
    string,
    { weight: number; weightUnit: WeightUnit; reps: number | null; rpe: number | null }[]
  >();

  for (const pe of session.programDay.exercises) {
    const prevSession = await prisma.workoutSession.findFirst({
      where: {
        id: { not: sessionId },
        status: "COMPLETED",
        programInstance: { userId },
        sets: { some: { programExerciseId: pe.id, done: true } },
      },
      orderBy: { performedAt: "desc" },
      include: {
        sets: { where: { programExerciseId: pe.id }, orderBy: { setIndex: "asc" } },
      },
    });
    if (prevSession) {
      previousByExerciseId.set(
        pe.id,
        prevSession.sets.map((s) => ({
          weight: s.weight,
          weightUnit: s.weightUnit,
          reps: s.reps,
          rpe: s.rpe,
        })),
      );
    }
  }

  return { session, settings, previousByExerciseId, displayUnit: unit };
}
