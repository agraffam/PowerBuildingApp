import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { WeightUnit } from "@prisma/client";
import { requireUserId } from "@/lib/auth/require-user";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ exerciseId: string }> },
) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { exerciseId } = await ctx.params;
  const body = (await req.json()) as {
    estimatedOneRm?: number;
    weightUnit?: WeightUnit;
  };

  const ex = await prisma.exercise.findUnique({ where: { id: exerciseId } });
  if (!ex) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.estimatedOneRm == null || !(body.estimatedOneRm > 0)) {
    return NextResponse.json({ error: "estimatedOneRm must be > 0" }, { status: 400 });
  }
  const wu = body.weightUnit ?? "LB";

  const profile = await prisma.userStrengthProfile.upsert({
    where: { userId_exerciseId: { userId, exerciseId } },
    create: {
      userId,
      exerciseId,
      estimatedOneRm: body.estimatedOneRm,
      weightUnit: wu,
    },
    update: {
      estimatedOneRm: body.estimatedOneRm,
      weightUnit: wu,
    },
  });

  return NextResponse.json({
    id: profile.id,
    exerciseId: ex.id,
    estimatedOneRm: profile.estimatedOneRm,
    weightUnit: profile.weightUnit,
    updatedAt: profile.updatedAt,
  });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ exerciseId: string }> },
) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { exerciseId } = await ctx.params;
  await prisma.userStrengthProfile.deleteMany({ where: { userId, exerciseId } });
  return NextResponse.json({ ok: true });
}
