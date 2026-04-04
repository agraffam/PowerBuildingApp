import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BlockType } from "@prisma/client";
import { validateMesocycleBlocks } from "@/lib/program-periodization";
import { validateSupersetSets } from "@/lib/program-superset-validation";
import { requireUserId } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

const noStoreJson = { headers: { "Cache-Control": "private, no-store, max-age=0" } };

export async function GET() {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  try {
    const programs = await prisma.program.findMany({
      where: {
        OR: [{ ownerId: null }, { ownerId: userId }],
      },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { days: true, blocks: true } },
      },
    });
    return NextResponse.json(programs, noStoreJson);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { ...noStoreJson, status: 500 });
  }
}

type WizardBody = {
  name: string;
  durationWeeks: number;
  blocks: { blockType: keyof typeof BlockType; startWeek: number; endWeek: number }[];
  days: {
    label: string;
    exercises: {
      exerciseSlug: string;
      sets: number;
      repTarget: number;
      targetRpe: number;
      pctOf1rm?: number | null;
      restSec?: number | null;
      useBodyweight?: boolean | null;
      supersetGroup?: string | null;
    }[];
  }[];
};

export async function POST(req: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const body = (await req.json()) as WizardBody;
  if (!body.name?.trim() || !body.durationWeeks || body.days?.length < 1) {
    return NextResponse.json({ error: "Invalid program payload" }, { status: 400 });
  }

  const period = validateMesocycleBlocks(body.durationWeeks, body.blocks ?? []);
  if (!period.ok) {
    return NextResponse.json({ error: period.error }, { status: 400 });
  }

  const sup = validateSupersetSets(body.days);
  if (!sup.ok) {
    return NextResponse.json({ error: sup.error }, { status: 400 });
  }

  try {
    const program = await prisma.$transaction(async (tx) => {
      const allExercises = await tx.exercise.findMany({
        where: { slug: { in: body.days.flatMap((d) => d.exercises.map((e) => e.exerciseSlug)) } },
      });
      const bySlug = new Map(allExercises.map((e) => [e.slug, e]));

      return tx.program.create({
        data: {
          name: body.name.trim(),
          durationWeeks: body.durationWeeks,
          ownerId: userId,
          blocks: {
            create: body.blocks.map((b, sortOrder) => ({
              blockType:
                (BlockType as Record<string, BlockType>)[b.blockType as string] ?? BlockType.HYPERTROPHY,
              sortOrder,
              startWeek: b.startWeek,
              endWeek: b.endWeek,
            })),
          },
          days: {
            create: body.days.map((day, di) => ({
              sortOrder: di,
              label: day.label,
              exercises: {
                create: day.exercises.map((ex, ei) => {
                  const exRow = bySlug.get(ex.exerciseSlug);
                  if (!exRow) throw new Error(`Unknown exercise: ${ex.exerciseSlug}`);
                  return {
                    exerciseId: exRow.id,
                    sortOrder: ei,
                    supersetGroup: ex.supersetGroup?.trim() || null,
                    sets: ex.sets,
                    repTarget: ex.repTarget,
                    targetRpe: ex.targetRpe,
                    pctOf1rm: ex.pctOf1rm ?? null,
                    restSec: ex.restSec ?? null,
                    useBodyweight: ex.useBodyweight ?? null,
                  };
                }),
              },
            })),
          },
        },
      });
    });
    return NextResponse.json(program);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create program";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
