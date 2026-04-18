import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserContext } from "@/lib/auth/require-user";
import { userCanEditProgramIncludingAdmin } from "@/lib/program-access";
import { snapProgramRestSec } from "@/lib/rest-by-rpe";
import { persistRepTargetRpe } from "@/lib/wizard-exercise-persist";

const patchBodySchema = z
  .object({
    restSec: z
      .union([z.number().finite().min(15).max(3600), z.null()])
      .optional(),
    useBodyweight: z.boolean().nullable().optional(),
    notes: z.string().nullable().optional(),
    targetDurationSec: z.union([z.number().int().min(0).max(86400), z.null()]).optional(),
    targetCalories: z.union([z.number().int().min(0).max(50000), z.null()]).optional(),
    sets: z.number().int().min(1).max(99).optional(),
    repTarget: z.union([z.number().int().min(1).max(999), z.null()]).optional(),
    targetRpe: z.union([z.number().min(6).max(10), z.null()]).optional(),
    pctOf1rm: z.number().min(0).max(100).nullable().optional(),
    supersetGroup: z.string().nullable().optional(),
  })
  .refine(
    (o) =>
      o.restSec !== undefined ||
      o.useBodyweight !== undefined ||
      o.notes !== undefined ||
      o.targetDurationSec !== undefined ||
      o.targetCalories !== undefined ||
      o.sets !== undefined ||
      o.repTarget !== undefined ||
      o.targetRpe !== undefined ||
      o.pctOf1rm !== undefined ||
      o.supersetGroup !== undefined,
    {
      message: "At least one field required",
    },
  );

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ programExerciseId: string }> },
) {
  const auth = await requireUserContext();
  if (auth instanceof NextResponse) return auth;
  const { userId, email } = auth;

  const { programExerciseId } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchBodySchema.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const body = parsed.data;

  const pe = await prisma.programExercise.findUnique({
    where: { id: programExerciseId },
    include: {
      programDay: { include: { program: true } },
      exercise: { select: { kind: true } },
    },
  });
  if (!pe) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ownerId = pe.programDay.program.ownerId;
  if (!userCanEditProgramIncludingAdmin(ownerId, userId, email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data: {
    restSec?: number | null;
    useBodyweight?: boolean | null;
    notes?: string | null;
    targetDurationSec?: number | null;
    targetCalories?: number | null;
    sets?: number;
    repTarget?: number | null;
    targetRpe?: number | null;
    pctOf1rm?: number | null;
    supersetGroup?: string | null;
  } = {};
  if (body.restSec !== undefined) {
    data.restSec =
      body.restSec === null ? null : snapProgramRestSec(body.restSec);
  }
  if (body.useBodyweight !== undefined) {
    data.useBodyweight = body.useBodyweight;
  }
  if (body.notes !== undefined) {
    data.notes = body.notes === null ? null : body.notes.trim() || null;
  }
  if (body.targetDurationSec !== undefined) {
    data.targetDurationSec = body.targetDurationSec;
  }
  if (body.targetCalories !== undefined) {
    data.targetCalories = body.targetCalories;
  }
  if (body.sets !== undefined) {
    data.sets = body.sets;
  }
  if (body.repTarget !== undefined || body.targetRpe !== undefined) {
    const repIn = body.repTarget !== undefined ? body.repTarget : pe.repTarget;
    const rpeIn = body.targetRpe !== undefined ? body.targetRpe : pe.targetRpe;
    const rx = persistRepTargetRpe(pe.exercise.kind, repIn, rpeIn);
    data.repTarget = rx.repTarget;
    data.targetRpe = rx.targetRpe;
  }
  if (body.pctOf1rm !== undefined) {
    data.pctOf1rm = body.pctOf1rm;
  }
  if (body.supersetGroup !== undefined) {
    data.supersetGroup = body.supersetGroup?.trim() || null;
  }

  const updated = await prisma.programExercise.update({
    where: { id: programExerciseId },
    data,
  });

  return NextResponse.json({ programExercise: updated });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ programExerciseId: string }> },
) {
  const auth = await requireUserContext();
  if (auth instanceof NextResponse) return auth;
  const { userId, email } = auth;

  const { programExerciseId } = await ctx.params;

  const pe = await prisma.programExercise.findUnique({
    where: { id: programExerciseId },
    include: { programDay: { include: { program: true } } },
  });
  if (!pe) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ownerId = pe.programDay.program.ownerId;
  if (!userCanEditProgramIncludingAdmin(ownerId, userId, email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const loggedCount = await prisma.loggedSet.count({
    where: { programExerciseId },
  });
  if (loggedCount > 0) {
    return NextResponse.json(
      { error: "Cannot remove this slot: it already has logged sets in workout history." },
      { status: 409 },
    );
  }

  await prisma.programExercise.delete({ where: { id: programExerciseId } });
  return NextResponse.json({ ok: true });
}
