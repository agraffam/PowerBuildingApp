import { prisma } from "@/lib/prisma";

/** Per-lift bar step: user override, else library default on Exercise. */
export async function getBarIncrementLbForUser(
  exerciseId: string,
  userId: string,
  exerciseLibraryDefault: number | null,
): Promise<number | null> {
  const pref = await prisma.userExerciseLift.findUnique({
    where: { userId_exerciseId: { userId, exerciseId } },
  });
  if (pref?.barIncrementLb != null) return pref.barIncrementLb;
  return exerciseLibraryDefault ?? null;
}
