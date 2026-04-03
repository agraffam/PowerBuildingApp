import { prisma } from "@/lib/prisma";
import { prefillHistoryWeightsForSession, prefillPctWeightsForSession } from "@/lib/prefill-session-weights";

export async function getInstanceReplacementExerciseId(
  programInstanceId: string,
  programExerciseId: string,
  templateExerciseId: string,
): Promise<string> {
  const row = await prisma.programInstanceExerciseReplacement.findUnique({
    where: {
      programInstanceId_programExerciseId: { programInstanceId, programExerciseId },
    },
  });
  return row?.replacementExerciseId ?? templateExerciseId;
}

export async function getEffectiveExerciseId(
  programInstanceId: string,
  sessionId: string | null,
  programExerciseId: string,
  templateExerciseId: string,
): Promise<string> {
  if (sessionId) {
    const swap = await prisma.workoutSessionExerciseSwap.findUnique({
      where: {
        workoutSessionId_programExerciseId: { workoutSessionId: sessionId, programExerciseId },
      },
    });
    if (swap) return swap.replacementExerciseId;
  }
  return getInstanceReplacementExerciseId(programInstanceId, programExerciseId, templateExerciseId);
}

/** Batch-load swap maps for a session (session-level overrides + instance-level defaults). */
export async function loadSwapMapsForSession(
  sessionId: string,
  programInstanceId: string,
): Promise<{ sessionMap: Map<string, string>; instanceMap: Map<string, string> }> {
  const [sessionSwaps, instanceRep] = await Promise.all([
    prisma.workoutSessionExerciseSwap.findMany({ where: { workoutSessionId: sessionId } }),
    prisma.programInstanceExerciseReplacement.findMany({ where: { programInstanceId } }),
  ]);
  const sessionMap = new Map<string, string>(
    sessionSwaps.map((s) => [s.programExerciseId, s.replacementExerciseId]),
  );
  const instanceMap = new Map<string, string>(
    instanceRep.map((r) => [r.programExerciseId, r.replacementExerciseId]),
  );
  return { sessionMap, instanceMap };
}

export function resolveEffectiveFromMaps(
  programExerciseId: string,
  templateExerciseId: string,
  sessionMap: Map<string, string>,
  instanceMap: Map<string, string>,
): string {
  return sessionMap.get(programExerciseId) ?? instanceMap.get(programExerciseId) ?? templateExerciseId;
}

/** Clears session-level swaps, updates logged exercise ids, and refills weights for every open session on the instance. */
async function propagateProgramReplacementToOpenSessions(
  programInstanceId: string,
  programExerciseId: string,
  replacementExerciseId: string,
  userId: string,
) {
  const openSessions = await prisma.workoutSession.findMany({
    where: {
      programInstanceId,
      status: { in: ["PLANNED", "IN_PROGRESS"] },
    },
    select: { id: true },
  });
  const ids = openSessions.map((s) => s.id);
  if (ids.length === 0) return;

  await prisma.workoutSessionExerciseSwap.deleteMany({
    where: { programExerciseId, workoutSessionId: { in: ids } },
  });
  await prisma.loggedSet.updateMany({
    where: { programExerciseId, workoutSessionId: { in: ids } },
    data: { loggedExerciseId: replacementExerciseId },
  });
  for (const sid of ids) {
    await prefillPctWeightsForSession(sid, userId);
    await prefillHistoryWeightsForSession(sid, userId);
  }
}

/** Upsert instance-level replacement (per-user program copy) and sync all open workout sessions. */
export async function applyInstanceExerciseReplacement(args: {
  userId: string;
  programInstanceId: string;
  programExerciseId: string;
  replacementExerciseId: string;
}): Promise<void> {
  const instance = await prisma.programInstance.findFirst({
    where: { id: args.programInstanceId, userId: args.userId, status: "ACTIVE" },
    include: { program: { include: { days: { include: { exercises: { select: { id: true } } } } } } },
  });
  if (!instance) throw new Error("NOT_FOUND");

  const belongs = instance.program.days.some((d) =>
    d.exercises.some((e) => e.id === args.programExerciseId),
  );
  if (!belongs) throw new Error("BAD_PE");

  const ex = await prisma.exercise.findUnique({ where: { id: args.replacementExerciseId } });
  if (!ex) throw new Error("BAD_EX");

  await prisma.programInstanceExerciseReplacement.upsert({
    where: {
      programInstanceId_programExerciseId: {
        programInstanceId: args.programInstanceId,
        programExerciseId: args.programExerciseId,
      },
    },
    create: {
      programInstanceId: args.programInstanceId,
      programExerciseId: args.programExerciseId,
      replacementExerciseId: args.replacementExerciseId,
    },
    update: { replacementExerciseId: args.replacementExerciseId },
  });

  await propagateProgramReplacementToOpenSessions(
    args.programInstanceId,
    args.programExerciseId,
    args.replacementExerciseId,
    args.userId,
  );
}

export async function applyExerciseSwap(args: {
  userId: string;
  sessionId: string;
  programExerciseId: string;
  replacementExerciseId: string;
  scope: "session" | "program";
}): Promise<void> {
  const session = await prisma.workoutSession.findUnique({
    where: { id: args.sessionId },
    include: { programInstance: true, programDay: { include: { exercises: true } } },
  });
  if (!session || session.programInstance.userId !== args.userId) {
    throw new Error("NOT_FOUND");
  }
  if (session.status !== "PLANNED" && session.status !== "IN_PROGRESS") {
    throw new Error("BAD_STATE");
  }

  const pe = session.programDay.exercises.find((e) => e.id === args.programExerciseId);
  if (!pe) throw new Error("BAD_PE");

  const ex = await prisma.exercise.findUnique({ where: { id: args.replacementExerciseId } });
  if (!ex) throw new Error("BAD_EX");

  const instId = session.programInstanceId;

  if (args.scope === "program") {
    await prisma.programInstanceExerciseReplacement.upsert({
      where: {
        programInstanceId_programExerciseId: {
          programInstanceId: instId,
          programExerciseId: args.programExerciseId,
        },
      },
      create: {
        programInstanceId: instId,
        programExerciseId: args.programExerciseId,
        replacementExerciseId: args.replacementExerciseId,
      },
      update: { replacementExerciseId: args.replacementExerciseId },
    });
    await propagateProgramReplacementToOpenSessions(
      instId,
      args.programExerciseId,
      args.replacementExerciseId,
      args.userId,
    );
    return;
  }

  await prisma.workoutSessionExerciseSwap.upsert({
    where: {
      workoutSessionId_programExerciseId: {
        workoutSessionId: args.sessionId,
        programExerciseId: args.programExerciseId,
      },
    },
    create: {
      workoutSessionId: args.sessionId,
      programExerciseId: args.programExerciseId,
      replacementExerciseId: args.replacementExerciseId,
    },
    update: { replacementExerciseId: args.replacementExerciseId },
  });

  await prisma.loggedSet.updateMany({
    where: { workoutSessionId: args.sessionId, programExerciseId: args.programExerciseId },
    data: { loggedExerciseId: args.replacementExerciseId },
  });

  await prefillPctWeightsForSession(args.sessionId, args.userId);
  await prefillHistoryWeightsForSession(args.sessionId, args.userId);
}

type DayLike = {
  id: string;
  exercises: {
    id: string;
    exerciseId: string;
    exercise: { id: string; name: string; slug: string; barIncrementLb?: number | null };
    [key: string]: unknown;
  }[];
  [key: string]: unknown;
};

/** Apply instance-level replacements for train preview / week overview (no session yet). */
export async function enrichProgramDaysWithInstanceReplacements(
  programInstanceId: string,
  days: DayLike[],
): Promise<DayLike[]> {
  const reps = await prisma.programInstanceExerciseReplacement.findMany({
    where: { programInstanceId },
  });
  if (reps.length === 0) return days;

  const repMap = new Map(reps.map((r) => [r.programExerciseId, r.replacementExerciseId]));
  const exIds = [...new Set(reps.map((r) => r.replacementExerciseId))];
  const exercises = await prisma.exercise.findMany({ where: { id: { in: exIds } } });
  const exById = new Map(exercises.map((e) => [e.id, e]));

  return days.map((day) => ({
    ...day,
    exercises: day.exercises.map((pe) => {
      const repId = repMap.get(pe.id);
      if (!repId) return pe;
      const nx = exById.get(repId);
      if (!nx) return pe;
      return {
        ...pe,
        exerciseId: nx.id,
        exercise: {
          id: nx.id,
          name: nx.name,
          slug: nx.slug,
          barIncrementLb: nx.barIncrementLb,
        },
      };
    }),
  }));
}
