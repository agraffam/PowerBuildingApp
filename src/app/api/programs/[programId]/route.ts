import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BlockType } from "@prisma/client";
import type { ProgramWizardPayload } from "@/lib/program-wizard-types";
import {
  validateDeloadIntervalWeeks,
  validateMesocycleBlocks,
  validatePeakingBlockOrder,
  validateProgramDurationWeeks,
} from "@/lib/program-periodization";
import { validateSupersetSets } from "@/lib/program-superset-validation";
import { persistRepTargetRpe } from "@/lib/wizard-exercise-persist";
import { requireUserContext, requireUserId } from "@/lib/auth/require-user";
import {
  userCanEditProgramIncludingAdmin,
  userCanEditProgramStructure,
  userCanViewProgram,
} from "@/lib/program-access";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ programId: string }> },
) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { programId } = await ctx.params;

  const program = await prisma.program.findUnique({
    where: { id: programId },
    include: {
      blocks: { orderBy: { sortOrder: "asc" } },
      days: {
        orderBy: { sortOrder: "asc" },
            include: {
              exercises: {
                orderBy: { sortOrder: "asc" },
                include: {
                  exercise: {
                    select: { id: true, name: true, slug: true, notes: true, kind: true, isBodyweight: true },
                  },
                },
              },
            },
      },
    },
  });

  if (!program || !userCanViewProgram(program.ownerId, userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sessionCount = await prisma.workoutSession.count({
    where: { programInstance: { programId, userId } },
  });

  const programInstanceCount = await prisma.programInstance.count({ where: { programId } });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  const canDeleteProgram = userCanEditProgramStructure(program.ownerId, userId);
  const canEditStructure = userCanEditProgramIncludingAdmin(program.ownerId, userId, user?.email ?? "");

  return NextResponse.json({
    program,
    hasWorkoutHistory: sessionCount > 0,
    canDeleteProgram,
    canEditStructure,
    programInstanceCount,
  });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ programId: string }> },
) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { programId } = await ctx.params;

  const program = await prisma.program.findUnique({ where: { id: programId } });
  if (!program || !userCanEditProgramStructure(program.ownerId, userId)) {
    return NextResponse.json(
      { error: "Only programs you created can be deleted." },
      { status: 404 },
    );
  }

  let confirmDeleteInstances = false;
  try {
    const raw = await req.json();
    if (raw && typeof raw === "object" && (raw as { confirmDeleteInstances?: unknown }).confirmDeleteInstances === true) {
      confirmDeleteInstances = true;
    }
  } catch {
    /* empty body */
  }

  const programInstanceCount = await prisma.programInstance.count({ where: { programId } });
  if (programInstanceCount > 0 && !confirmDeleteInstances) {
    return NextResponse.json(
      {
        error: `This program has ${programInstanceCount} saved run(s). Deleting removes all progress and history for those runs.`,
        code: "CONFIRM_DELETE_INSTANCES",
        programInstanceCount,
      },
      { status: 409 },
    );
  }

  await prisma.program.delete({ where: { id: programId } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ programId: string }> },
) {
  const auth = await requireUserContext();
  if (auth instanceof NextResponse) return auth;
  const { userId, email } = auth;

  const { programId } = await ctx.params;
  const body = (await req.json()) as Partial<ProgramWizardPayload>;

  const program = await prisma.program.findUnique({ where: { id: programId } });
  if (!program || !userCanViewProgram(program.ownerId, userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sessionCount = await prisma.workoutSession.count({
    where: { programInstance: { programId, userId } },
  });
  const hasHistory = sessionCount > 0;

  if (!userCanEditProgramIncludingAdmin(program.ownerId, userId, email)) {
    return NextResponse.json(
      { error: "System templates cannot be edited. Duplicate to customize." },
      { status: 403 },
    );
  }

  const wantsStructure = body.days != null || body.blocks != null;
  if (!wantsStructure) {
    if (body.durationWeeks != null) {
      const dur = validateProgramDurationWeeks(body.durationWeeks);
      if (!dur.ok) return NextResponse.json({ error: dur.error }, { status: 400 });
    }
    if (body.deloadIntervalWeeks !== undefined) {
      const dv = validateDeloadIntervalWeeks(body.deloadIntervalWeeks);
      if (!dv.ok) return NextResponse.json({ error: dv.error }, { status: 400 });
    }
    await prisma.program.update({
      where: { id: programId },
      data: {
        ...(body.name != null && { name: body.name.trim() }),
        ...(body.durationWeeks != null && { durationWeeks: body.durationWeeks }),
        ...(body.deloadIntervalWeeks !== undefined && {
          deloadIntervalWeeks: body.deloadIntervalWeeks,
        }),
        ...(body.autoBlockPrescriptions !== undefined && {
          autoBlockPrescriptions: body.autoBlockPrescriptions,
        }),
      },
    });
    const fresh = await prisma.program.findUnique({
      where: { id: programId },
      include: {
        blocks: { orderBy: { sortOrder: "asc" } },
        days: {
          orderBy: { sortOrder: "asc" },
            include: {
              exercises: {
                orderBy: { sortOrder: "asc" },
                include: {
                  exercise: {
                    select: { id: true, name: true, slug: true, notes: true, kind: true, isBodyweight: true },
                  },
                },
              },
            },
        },
      },
    });
    return NextResponse.json({ program: fresh, hasWorkoutHistory: hasHistory });
  }

  const full = body as ProgramWizardPayload;
  if (!full.name?.trim() || !full.durationWeeks || !full.days?.length || !full.blocks?.length) {
    return NextResponse.json({ error: "Invalid full program payload" }, { status: 400 });
  }

  const period = validateMesocycleBlocks(full.durationWeeks, full.blocks);
  if (!period.ok) {
    return NextResponse.json({ error: period.error }, { status: 400 });
  }


  const peakFull = validatePeakingBlockOrder(
    full.blocks.map((b) => ({ ...b, blockType: String(b.blockType) })),
  );
  if (!peakFull.ok) {
    return NextResponse.json({ error: peakFull.error }, { status: 400 });
  }
  const delFull = validateDeloadIntervalWeeks(
    full.deloadIntervalWeeks === undefined ? 5 : full.deloadIntervalWeeks,
  );
  if (!delFull.ok) {
    return NextResponse.json({ error: delFull.error }, { status: 400 });
  }

  const sup = validateSupersetSets(full.days);
  if (!sup.ok) {
    return NextResponse.json({ error: sup.error }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const allExercises = await tx.exercise.findMany({
        where: { slug: { in: full.days.flatMap((d) => d.exercises.map((e) => e.exerciseSlug)) } },
      });
      const bySlug = new Map(allExercises.map((e) => [e.slug, e]));

      await tx.programBlock.deleteMany({ where: { programId } });
      await tx.programDay.deleteMany({ where: { programId } });

      await tx.program.update({
        where: { id: programId },
        data: {
          name: full.name.trim(),
          durationWeeks: full.durationWeeks,
          deloadIntervalWeeks:
            full.deloadIntervalWeeks === undefined ? 5 : full.deloadIntervalWeeks,
          autoBlockPrescriptions: full.autoBlockPrescriptions !== false,
          blocks: {
            create: full.blocks.map((b, sortOrder) => ({
              blockType:
                (BlockType as Record<string, BlockType>)[b.blockType as string] ?? BlockType.HYPERTROPHY,
              sortOrder,
              startWeek: b.startWeek,
              endWeek: b.endWeek,
            })),
          },
          days: {
            create: full.days.map((day, di) => ({
              sortOrder: di,
              label: day.label,
              exercises: {
                create: day.exercises.map((ex, ei) => {
                  const exRow = bySlug.get(ex.exerciseSlug);
                  if (!exRow) throw new Error(`Unknown exercise: ${ex.exerciseSlug}`);
                  const rx = persistRepTargetRpe(exRow.kind, ex.repTarget, ex.targetRpe);
                  return {
                    exerciseId: exRow.id,
                    sortOrder: ei,
                    supersetGroup: ex.supersetGroup?.trim() || null,
                    sets: ex.sets,
                    repTarget: rx.repTarget,
                    targetRpe: rx.targetRpe,
                    pctOf1rm: ex.pctOf1rm ?? null,
                    restSec: ex.restSec ?? null,
                    useBodyweight: ex.useBodyweight ?? null,
                    notes: ex.notes?.trim() || null,
                    targetDurationSec: ex.targetDurationSec ?? null,
                    targetCalories: ex.targetCalories ?? null,
                  };
                }),
              },
            })),
          },
        },
      });
    });

    const fresh = await prisma.program.findUnique({
      where: { id: programId },
      include: {
        blocks: { orderBy: { sortOrder: "asc" } },
        days: {
          orderBy: { sortOrder: "asc" },
            include: {
              exercises: {
                orderBy: { sortOrder: "asc" },
                include: {
                  exercise: {
                    select: { id: true, name: true, slug: true, notes: true, kind: true, isBodyweight: true },
                  },
                },
              },
            },
        },
      },
    });
    return NextResponse.json({ program: fresh, hasWorkoutHistory: hasHistory });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
