import { NextResponse } from "next/server";
import { ExerciseKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STANDARD_BAR_INCREMENTS_LB } from "@/lib/calculators";
import { requireUserContext } from "@/lib/auth/require-user";
import { isAdminEmail } from "@/lib/auth/is-admin";

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
  const auth = await requireUserContext();
  if (auth instanceof NextResponse) return auth;
  const { userId, email } = auth;

  const { exerciseId } = await ctx.params;
  const body = (await req.json()) as {
    barIncrementLb?: unknown;
    isBodyweight?: unknown;
    name?: unknown;
    muscleTags?: unknown;
    notes?: unknown;
    kind?: unknown;
  };

  const admin = isAdminEmail(email);

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

  let name: string | undefined;
  if ("name" in body && body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
    }
    name = body.name.trim();
  }

  let muscleTags: string | null | undefined;
  if ("muscleTags" in body && body.muscleTags !== undefined) {
    if (body.muscleTags !== null && typeof body.muscleTags !== "string") {
      return NextResponse.json({ error: "muscleTags must be string or null" }, { status: 400 });
    }
    muscleTags = typeof body.muscleTags === "string" ? body.muscleTags.trim() : null;
  }

  let notes: string | null | undefined;
  if ("notes" in body && body.notes !== undefined) {
    if (body.notes !== null && typeof body.notes !== "string") {
      return NextResponse.json({ error: "notes must be string or null" }, { status: 400 });
    }
    notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
  }

  let kind: ExerciseKind | undefined;
  if ("kind" in body && body.kind !== undefined) {
    if (body.kind !== "STRENGTH" && body.kind !== "CARDIO") {
      return NextResponse.json({ error: "kind must be STRENGTH or CARDIO" }, { status: 400 });
    }
    kind = body.kind as ExerciseKind;
  }

  const wantsGlobalEdit =
    isBodyweight !== undefined ||
    name !== undefined ||
    muscleTags !== undefined ||
    notes !== undefined ||
    kind !== undefined;

  if (wantsGlobalEdit && !admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (barIncrementLb === undefined && !wantsGlobalEdit) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
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

  if (wantsGlobalEdit && admin) {
    await prisma.exercise.update({
      where: { id: exerciseId },
      data: {
        ...(isBodyweight !== undefined ? { isBodyweight } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(muscleTags !== undefined ? { muscleTags: muscleTags ?? "" } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(kind !== undefined ? { kind } : {}),
      },
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
