import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/require-user";

/** All exercises with optional per-user strength profile (for Strength page). */
export async function GET(req: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const q = new URL(req.url).searchParams.get("q")?.toLowerCase() ?? "";

  const exercises = await prisma.exercise.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q } },
            { slug: { contains: q } },
            { muscleTags: { contains: q } },
          ],
        }
      : {},
    orderBy: { name: "asc" },
    include: {
      userStrengthProfiles: { where: { userId } },
    },
  });

  const out = exercises.map((ex) => {
    const p = ex.userStrengthProfiles[0] ?? null;
    return {
      id: ex.id,
      name: ex.name,
      slug: ex.slug,
      muscleTags: ex.muscleTags,
      notes: ex.notes,
      barIncrementLb: ex.barIncrementLb,
      createdAt: ex.createdAt,
      strengthProfile: p
        ? {
            id: p.id,
            exerciseId: ex.id,
            estimatedOneRm: p.estimatedOneRm,
            weightUnit: p.weightUnit,
            updatedAt: p.updatedAt,
          }
        : null,
    };
  });

  return NextResponse.json(out);
}
