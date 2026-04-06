import { prisma } from "@/lib/prisma";

export async function loadBodyweightOverrideMaps(sessionId: string, programInstanceId: string) {
  const [sessionRows, instanceRows] = await Promise.all([
    prisma.workoutSessionExerciseBodyweight.findMany({ where: { workoutSessionId: sessionId } }),
    prisma.programInstanceExerciseBodyweight.findMany({
      where: { programInstanceId },
    }),
  ]);
  return {
    sessionByProgramExerciseId: new Map(
      sessionRows.map((r) => [r.programExerciseId, r.useBodyweight]),
    ),
    instanceByProgramExerciseId: new Map(
      instanceRows.map((r) => [r.programExerciseId, r.useBodyweight]),
    ),
  };
}
