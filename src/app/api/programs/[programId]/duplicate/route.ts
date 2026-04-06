import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/require-user";
import { userCanViewProgram } from "@/lib/program-access";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ programId: string }> },
) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { programId } = await ctx.params;

  const src = await prisma.program.findUnique({
    where: { id: programId },
    include: {
      blocks: { orderBy: { sortOrder: "asc" } },
      days: {
        orderBy: { sortOrder: "asc" },
        include: { exercises: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  if (!src || !userCanViewProgram(src.ownerId, userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const copy = await prisma.program.create({
    data: {
      name: `${src.name} (copy)`,
      durationWeeks: src.durationWeeks,
      ownerId: userId,
      blocks: {
        create: src.blocks.map((b) => ({
          blockType: b.blockType,
          sortOrder: b.sortOrder,
          startWeek: b.startWeek,
          endWeek: b.endWeek,
        })),
      },
      days: {
        create: src.days.map((d) => ({
          sortOrder: d.sortOrder,
          label: d.label,
          exercises: {
            create: d.exercises.map((e) => ({
              exerciseId: e.exerciseId,
              sortOrder: e.sortOrder,
              supersetGroup: e.supersetGroup,
              sets: e.sets,
              repTarget: e.repTarget,
              targetRpe: e.targetRpe,
              pctOf1rm: e.pctOf1rm,
              restSec: e.restSec,
              useBodyweight: e.useBodyweight,
              notes: e.notes,
              targetDurationSec: e.targetDurationSec,
              targetCalories: e.targetCalories,
            })),
          },
        })),
      },
    },
  });

  return NextResponse.json({ program: copy });
}
