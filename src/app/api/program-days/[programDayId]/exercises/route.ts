import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserContext } from "@/lib/auth/require-user";
import { userCanEditProgramIncludingAdmin } from "@/lib/program-access";
import { persistRepTargetRpe } from "@/lib/wizard-exercise-persist";

const postSchema = z.object({
  exerciseSlug: z.string().min(1),
  sets: z.number().int().min(1).max(99),
  repTarget: z.union([z.number().int().min(1).max(999), z.null()]).optional(),
  targetRpe: z.union([z.number().min(6).max(10), z.null()]).optional(),
  pctOf1rm: z.number().min(0).max(100).nullable().optional(),
  restSec: z.number().int().min(15).max(3600).nullable().optional(),
  useBodyweight: z.boolean().nullable().optional(),
  notes: z.string().nullable().optional(),
  targetDurationSec: z.number().int().min(0).max(86400).nullable().optional(),
  targetCalories: z.number().int().min(0).max(50000).nullable().optional(),
  supersetGroup: z.string().nullable().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ programDayId: string }> },
) {
  const auth = await requireUserContext();
  if (auth instanceof NextResponse) return auth;
  const { userId, email } = auth;

  const { programDayId } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }
  const body = parsed.data;

  const day = await prisma.programDay.findUnique({
    where: { id: programDayId },
    include: {
      program: true,
      exercises: { orderBy: { sortOrder: "desc" }, take: 1 },
    },
  });
  if (!day) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!userCanEditProgramIncludingAdmin(day.program.ownerId, userId, email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ex = await prisma.exercise.findUnique({ where: { slug: body.exerciseSlug } });
  if (!ex) return NextResponse.json({ error: "Unknown exercise" }, { status: 400 });

  const nextOrder = (day.exercises[0]?.sortOrder ?? -1) + 1;

  const rx = persistRepTargetRpe(ex.kind, body.repTarget, body.targetRpe);

  const row = await prisma.programExercise.create({
    data: {
      programDayId,
      exerciseId: ex.id,
      sortOrder: nextOrder,
      sets: body.sets,
      repTarget: rx.repTarget,
      targetRpe: rx.targetRpe,
      pctOf1rm: body.pctOf1rm ?? null,
      restSec: body.restSec ?? null,
      useBodyweight: body.useBodyweight ?? null,
      notes: body.notes?.trim() || null,
      targetDurationSec: body.targetDurationSec ?? null,
      targetCalories: body.targetCalories ?? null,
      supersetGroup: body.supersetGroup?.trim() || null,
    },
    include: {
      exercise: { select: { id: true, name: true, slug: true, kind: true, isBodyweight: true } },
    },
  });

  return NextResponse.json({ programExercise: row });
}
