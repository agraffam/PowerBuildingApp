import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STANDARD_BAR_INCREMENTS_LB } from "@/lib/calculators";
import { requireUserId } from "@/lib/auth/require-user";

function parseBarIncrementLb(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    throw new Error("barIncrementLb must be 2.5, 5, 10, or null");
  }
  for (const s of STANDARD_BAR_INCREMENTS_LB) {
    if (Math.abs(n - s) < 0.001) return s;
  }
  throw new Error("barIncrementLb must be 2.5, 5, 10, or null");
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ exerciseId: string }> },
) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { exerciseId } = await ctx.params;
  const body = (await req.json()) as { barIncrementLb?: unknown; isBodyweight?: unknown };

  let barIncrementLb: number | null | undefined;
  if ("barIncrementLb" in body) {
    try {
      barIncrementLb = parseBarIncrementLb(body.barIncrementLb);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid bar increment";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  let isBodyweight: boolean | undefined;
  if ("isBodyweight" in body) {
    if (typeof body.isBodyweight !== "boolean") {
      return NextResponse.json({ error: "isBodyweight must be boolean" }, { status: 400 });
    }
    isBodyweight = body.isBodyweight;
  }

  const existing = await prisma.exercise.findUnique({ where: { id: exerciseId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (barIncrementLb !== undefined) {
    await prisma.userExerciseLift.upsert({
      where: { userId_exerciseId: { userId, exerciseId } },
      create: {
        userId,
        exerciseId,
        barIncrementLb,
      },
      update: { barIncrementLb },
    });
  }

  if (isBodyweight !== undefined) {
    await prisma.exercise.update({
      where: { id: exerciseId },
      data: { isBodyweight },
    });
  }

  const pref = await prisma.userExerciseLift.findUnique({
    where: { userId_exerciseId: { userId, exerciseId } },
  });

  const fresh = await prisma.exercise.findUnique({ where: { id: exerciseId } });
  if (!fresh) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    ...fresh,
    barIncrementLb: pref?.barIncrementLb ?? fresh.barIncrementLb,
  });
}
