import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { WeightUnit } from "@prisma/client";
import { coerceDefaultBarIncrementLb } from "@/lib/calculators";
import { requireUserId } from "@/lib/auth/require-user";

export async function GET() {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  let s = await prisma.userSettings.findUnique({ where: { userId } });
  if (!s) {
    s = await prisma.userSettings.create({
      data: {
        userId,
        preferredWeightUnit: "LB",
        defaultRestSec: 120,
        plateIncrementLb: 2.5,
        plateIncrementKg: 2.5,
      },
    });
  }
  return NextResponse.json({
    ...s,
    plateIncrementLb: coerceDefaultBarIncrementLb(s.plateIncrementLb),
  });
}

export async function PATCH(req: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const body = (await req.json()) as {
    preferredWeightUnit?: WeightUnit;
    defaultRestSec?: number;
    plateIncrementLb?: number;
    plateIncrementKg?: number;
  };
  let s = await prisma.userSettings.findUnique({ where: { userId } });
  if (!s) {
    s = await prisma.userSettings.create({
      data: {
        userId,
        preferredWeightUnit: body.preferredWeightUnit ?? "LB",
        defaultRestSec: body.defaultRestSec ?? 120,
        plateIncrementLb: coerceDefaultBarIncrementLb(body.plateIncrementLb ?? 2.5),
        plateIncrementKg: body.plateIncrementKg ?? 2.5,
      },
    });
  } else {
    const nextLb =
      body.plateIncrementLb != null ? coerceDefaultBarIncrementLb(body.plateIncrementLb) : undefined;
    s = await prisma.userSettings.update({
      where: { id: s.id },
      data: {
        ...(body.preferredWeightUnit != null && { preferredWeightUnit: body.preferredWeightUnit }),
        ...(body.defaultRestSec != null && { defaultRestSec: body.defaultRestSec }),
        ...(nextLb != null && { plateIncrementLb: nextLb }),
        ...(body.plateIncrementKg != null && { plateIncrementKg: body.plateIncrementKg }),
      },
    });
  }
  return NextResponse.json({
    ...s,
    plateIncrementLb: coerceDefaultBarIncrementLb(s.plateIncrementLb),
  });
}
