import { prisma } from "@/lib/prisma";
import {
  prefillHistoryWeightsForSession,
  prefillPctWeightsForSession,
} from "@/lib/prefill-session-weights";

export async function applyBodyweightScope(args: {
  userId: string;
  sessionId: string;
  programExerciseId: string;
  useBodyweight: boolean;
  scope: "session" | "program";
}): Promise<void> {
  const session = await prisma.workoutSession.findUnique({
    where: { id: args.sessionId },
    include: { programInstance: true },
  });
  if (!session || session.programInstance.userId !== args.userId) {
    throw new Error("NOT_FOUND");
  }
  if (session.status !== "PLANNED" && session.status !== "IN_PROGRESS") {
    throw new Error("BAD_STATE");
  }

  if (args.scope === "session") {
    await prisma.workoutSessionExerciseBodyweight.upsert({
      where: {
        workoutSessionId_programExerciseId: {
          workoutSessionId: args.sessionId,
          programExerciseId: args.programExerciseId,
        },
      },
      create: {
        workoutSessionId: args.sessionId,
        programExerciseId: args.programExerciseId,
        useBodyweight: args.useBodyweight,
      },
      update: { useBodyweight: args.useBodyweight },
    });
  } else {
    await prisma.programInstanceExerciseBodyweight.upsert({
      where: {
        programInstanceId_programExerciseId: {
          programInstanceId: session.programInstanceId,
          programExerciseId: args.programExerciseId,
        },
      },
      create: {
        programInstanceId: session.programInstanceId,
        programExerciseId: args.programExerciseId,
        useBodyweight: args.useBodyweight,
      },
      update: { useBodyweight: args.useBodyweight },
    });
    await prisma.workoutSessionExerciseBodyweight.deleteMany({
      where: { workoutSessionId: args.sessionId, programExerciseId: args.programExerciseId },
    });
  }

  await prisma.loggedSet.updateMany({
    where: {
      workoutSessionId: args.sessionId,
      programExerciseId: args.programExerciseId,
      done: false,
    },
    data: { weight: 0 },
  });

  await prefillPctWeightsForSession(args.sessionId, args.userId);
  await prefillHistoryWeightsForSession(args.sessionId, args.userId);
}

/** Train / week overview: instance-level bodyweight without an open session row. */
export async function applyInstanceBodyweightOverride(args: {
  userId: string;
  programInstanceId: string;
  programExerciseId: string;
  useBodyweight: boolean;
}): Promise<void> {
  const instance = await prisma.programInstance.findFirst({
    where: { id: args.programInstanceId, userId: args.userId },
    include: {
      program: {
        include: { days: { include: { exercises: { select: { id: true } } } } },
      },
    },
  });
  if (!instance) throw new Error("NOT_FOUND");
  const belongs = instance.program.days.some((d) =>
    d.exercises.some((e) => e.id === args.programExerciseId),
  );
  if (!belongs) throw new Error("BAD_PE");

  await prisma.programInstanceExerciseBodyweight.upsert({
    where: {
      programInstanceId_programExerciseId: {
        programInstanceId: args.programInstanceId,
        programExerciseId: args.programExerciseId,
      },
    },
    create: {
      programInstanceId: args.programInstanceId,
      programExerciseId: args.programExerciseId,
      useBodyweight: args.useBodyweight,
    },
    update: { useBodyweight: args.useBodyweight },
  });

  await prisma.workoutSessionExerciseBodyweight.deleteMany({
    where: {
      programExerciseId: args.programExerciseId,
      workoutSession: {
        programInstanceId: args.programInstanceId,
        status: { in: ["PLANNED", "IN_PROGRESS"] },
      },
    },
  });

  const openSessions = await prisma.workoutSession.findMany({
    where: {
      programInstanceId: args.programInstanceId,
      status: { in: ["PLANNED", "IN_PROGRESS"] },
    },
    select: { id: true },
  });

  for (const s of openSessions) {
    await prisma.loggedSet.updateMany({
      where: {
        workoutSessionId: s.id,
        programExerciseId: args.programExerciseId,
        done: false,
      },
      data: { weight: 0 },
    });
    await prefillPctWeightsForSession(s.id, args.userId);
    await prefillHistoryWeightsForSession(s.id, args.userId);
  }
}
