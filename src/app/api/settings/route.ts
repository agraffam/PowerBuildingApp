import { NextResponse } from "next/server";
import { Prisma, type WeightUnit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { coerceDefaultBarIncrementLb } from "@/lib/calculators";
import { requireUserId } from "@/lib/auth/require-user";
import {
  mergeRestDurationsByRpe,
  overridesFromMerged,
  validateMergedRestMap,
} from "@/lib/rest-by-rpe";

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
        defaultRestSec: 180,
        plateIncrementLb: 2.5,
        plateIncrementKg: 2.5,
      },
    });
  }
  const merged = mergeRestDurationsByRpe(s.restDurationsByRpe);
  return NextResponse.json({
    ...s,
    plateIncrementLb: coerceDefaultBarIncrementLb(s.plateIncrementLb),
    restDurationsByRpe: merged,
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
    /** Full merged map, or null to clear overrides and use defaults only. */
    restDurationsByRpe?: Record<string, number> | null;
  };
  let s = await prisma.userSettings.findUnique({ where: { userId } });
  if (!s) {
    s = await prisma.userSettings.create({
      data: {
        userId,
        preferredWeightUnit: body.preferredWeightUnit ?? "LB",
        defaultRestSec: body.defaultRestSec ?? 180,
        plateIncrementLb: coerceDefaultBarIncrementLb(body.plateIncrementLb ?? 2.5),
        plateIncrementKg: body.plateIncrementKg ?? 2.5,
      },
    });
  }

  const nextDefaultRest =
    body.defaultRestSec != null
      ? Math.max(30, Math.min(600, Math.round(body.defaultRestSec)))
      : s.defaultRestSec;

  let restJson: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined;
  if (body.restDurationsByRpe === null) {
    restJson = Prisma.JsonNull;
  } else if (body.restDurationsByRpe != null && typeof body.restDurationsByRpe === "object") {
    const merged = validateMergedRestMap(body.restDurationsByRpe);
    if (!merged) {
      return NextResponse.json({ error: "Invalid restDurationsByRpe" }, { status: 400 });
    }
    const ov = overridesFromMerged(merged);
    restJson = ov ?? Prisma.JsonNull;
  }

  const nextLb =
    body.plateIncrementLb != null ? coerceDefaultBarIncrementLb(body.plateIncrementLb) : undefined;

  s = await prisma.userSettings.update({
    where: { id: s.id },
    data: {
      ...(body.preferredWeightUnit != null && { preferredWeightUnit: body.preferredWeightUnit }),
      ...(body.defaultRestSec != null && { defaultRestSec: nextDefaultRest }),
      ...(nextLb != null && { plateIncrementLb: nextLb }),
      ...(body.plateIncrementKg != null && { plateIncrementKg: body.plateIncrementKg }),
      ...(restJson !== undefined && { restDurationsByRpe: restJson }),
    },
  });

  const merged = mergeRestDurationsByRpe(s.restDurationsByRpe);
  return NextResponse.json({
    ...s,
    plateIncrementLb: coerceDefaultBarIncrementLb(s.plateIncrementLb),
    restDurationsByRpe: merged,
  });
}
