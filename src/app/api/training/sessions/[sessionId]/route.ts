import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionDetail } from "@/lib/training-queries";
import { readinessToIntensityScalar } from "@/lib/calculators";
import { syncProgramInstanceCursor } from "@/lib/program-week-state";
import { buildWeekCompletionSummary } from "@/lib/week-completion-summary";
import {
  mirrorWorkingWeightToRemainingSets,
  prefillHistoryWeightsForSession,
  prefillPctWeightsForSession,
} from "@/lib/prefill-session-weights";
import { requireUserContext, requireUserId } from "@/lib/auth/require-user";
import { userCanEditProgramIncludingAdmin } from "@/lib/program-access";
import { getBarIncrementLbForUser } from "@/lib/user-exercise-prefs";
import {
  applyExerciseSwap,
  loadSwapMapsForSession,
  resolveEffectiveFromMaps,
} from "@/lib/exercise-swaps";
import { loadBodyweightOverrideMaps } from "@/lib/bodyweight-override-maps";
import { effectiveUseBodyweightResolved } from "@/lib/exercise-bodyweight";
import { applyBodyweightScope } from "@/lib/bodyweight-scope";
import { buildSessionCompletionSummary } from "@/lib/session-completion-summary";
import { trainingSessionPatchBodySchema } from "@/lib/training-session-patch-schema";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ sessionId: string }> },
) {
  const auth = await requireUserContext();
  if (auth instanceof NextResponse) return auth;
  const { userId, email } = auth;

  const { sessionId } = await ctx.params;
  const detail = await getSessionDetail(sessionId, userId);
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { session, settings, previousByExerciseId, displayUnit } = detail;
  const prevObj = Object.fromEntries(previousByExerciseId.entries());

  const { sessionMap, instanceMap } = await loadSwapMapsForSession(
    session.id,
    session.programInstanceId,
  );
  const bwMaps = await loadBodyweightOverrideMaps(session.id, session.programInstanceId);
  const effIds = new Set<string>();
  for (const pe of session.programDay.exercises) {
    effIds.add(resolveEffectiveFromMaps(pe.id, pe.exerciseId, sessionMap, instanceMap));
  }
  const effExercises = await prisma.exercise.findMany({ where: { id: { in: [...effIds] } } });
  const exById = new Map(effExercises.map((e) => [e.id, e]));

  const barByEffectiveId = new Map<string, number | null>();
  for (const eid of effIds) {
    const exRow = exById.get(eid);
    if (!exRow) continue;
    barByEffectiveId.set(eid, await getBarIncrementLbForUser(eid, userId, exRow.barIncrementLb));
  }

  const programDayEnriched = {
    ...session.programDay,
    exercises: session.programDay.exercises.map((pe) => {
      const effId = resolveEffectiveFromMaps(pe.id, pe.exerciseId, sessionMap, instanceMap);
      const ex = exById.get(effId);
      const sessBw = bwMaps.sessionByProgramExerciseId.get(pe.id) ?? null;
      const instBw = bwMaps.instanceByProgramExerciseId.get(pe.id) ?? null;
      if (!ex) {
        const useBodyweightEffective = effectiveUseBodyweightResolved(
          { useBodyweight: pe.useBodyweight },
          { isBodyweight: pe.exercise.isBodyweight },
          { sessionOverride: sessBw, instanceOverride: instBw },
        );
        return {
          ...pe,
          useBodyweightEffective,
          exercise: {
            ...pe.exercise,
            notes: pe.exercise.notes,
            kind: pe.exercise.kind,
            muscleTags: pe.exercise.muscleTags,
            isBodyweight: pe.exercise.isBodyweight,
            effectiveBarIncrementLb: barByEffectiveId.get(pe.exerciseId) ?? null,
          },
        };
      }
      const useBodyweightEffective = effectiveUseBodyweightResolved(
        { useBodyweight: pe.useBodyweight },
        { isBodyweight: ex.isBodyweight },
        { sessionOverride: sessBw, instanceOverride: instBw },
      );
      return {
        ...pe,
        useBodyweightEffective,
        exercise: {
          id: ex.id,
          name: ex.name,
          slug: ex.slug,
          notes: ex.notes,
          kind: ex.kind,
          barIncrementLb: ex.barIncrementLb,
          isBodyweight: ex.isBodyweight,
          muscleTags: ex.muscleTags,
          effectiveBarIncrementLb: barByEffectiveId.get(effId) ?? null,
        },
      };
    }),
  };

  const sessionOut = {
    ...session,
    programDay: programDayEnriched,
  };

  const prog = session.programInstance.program;
  const canEditProgramRest = userCanEditProgramIncludingAdmin(prog.ownerId, userId, email);

  return NextResponse.json({
    session: sessionOut,
    settings,
    previousByExerciseId: prevObj,
    displayUnit,
    canEditProgramRest,
  });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ sessionId: string }> },
) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { sessionId } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsedBody = trainingSessionPatchBodySchema.safeParse(json);
  if (!parsedBody.success) {
    const msg = parsedBody.error.issues[0]?.message ?? "Invalid body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const body = parsedBody.data;

  const session = await prisma.workoutSession.findUnique({
    where: { id: sessionId },
    include: { programInstance: true },
  });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.programInstance.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (body.action === "cancel") {
    if (session.status !== "PLANNED" && session.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "Session cannot be cancelled" }, { status: 409 });
    }
    await prisma.workoutSession.update({
      where: { id: sessionId },
      data: { status: "CANCELLED" },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "swapExercise") {
    if (session.status !== "PLANNED" && session.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "Cannot swap exercise now" }, { status: 409 });
    }
    if (
      !body.programExerciseId ||
      !body.replacementExerciseId ||
      (body.scope !== "session" && body.scope !== "program")
    ) {
      return NextResponse.json({ error: "Invalid swap payload" }, { status: 400 });
    }
    try {
      await applyExerciseSwap({
        userId,
        sessionId,
        programExerciseId: body.programExerciseId,
        replacementExerciseId: body.replacementExerciseId,
        scope: body.scope,
      });
      return NextResponse.json({ ok: true });
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      if (code === "NOT_FOUND") return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (code === "BAD_STATE") return NextResponse.json({ error: "Session ended" }, { status: 409 });
      if (code === "BAD_PE") return NextResponse.json({ error: "Invalid exercise slot" }, { status: 400 });
      if (code === "BAD_EX") return NextResponse.json({ error: "Unknown exercise" }, { status: 400 });
      throw e;
    }
  }

  if (body.action === "setBodyweight") {
    if (session.status !== "PLANNED" && session.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "Cannot change bodyweight mode now" }, { status: 409 });
    }
    try {
      await applyBodyweightScope({
        userId,
        sessionId,
        programExerciseId: body.programExerciseId,
        useBodyweight: body.useBodyweight,
        scope: body.scope,
      });
      return NextResponse.json({ ok: true });
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      if (code === "NOT_FOUND") return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (code === "BAD_STATE") return NextResponse.json({ error: "Session ended" }, { status: 409 });
      throw e;
    }
  }

  if (body.action === "set" && session.status === "COMPLETED") {
    const row = await prisma.loggedSet.findFirst({
      where: { id: body.setId, workoutSessionId: sessionId },
    });
    if (!row) return NextResponse.json({ error: "Set not found" }, { status: 404 });
    const data: Record<string, unknown> = {};
    if (body.weight !== undefined) data.weight = body.weight;
    if (body.weightUnit != null) data.weightUnit = body.weightUnit;
    if (body.reps !== undefined) data.reps = body.reps;
    if (body.rpe !== undefined) data.rpe = body.rpe;
    if (body.durationSec !== undefined) data.durationSec = body.durationSec;
    if (body.calories !== undefined) data.calories = body.calories;
    if (body.done != null) {
      data.done = body.done;
      data.completedAt = body.done ? new Date() : null;
    }
    await prisma.loggedSet.update({
      where: { id: body.setId },
      data,
    });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "updateMetadata") {
    if (session.status !== "COMPLETED" && session.status !== "CANCELLED") {
      return NextResponse.json({ error: "Can only edit date on completed or cancelled workouts" }, { status: 409 });
    }
    const iso = body.performedAt;
    if (typeof iso !== "string") {
      return NextResponse.json({ error: "performedAt required" }, { status: 400 });
    }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    await prisma.workoutSession.update({
      where: { id: sessionId },
      data: { performedAt: d },
    });
    return NextResponse.json({ ok: true });
  }


  if (session.status === "COMPLETED" || session.status === "CANCELLED") {
    return NextResponse.json({ error: "Session is no longer active" }, { status: 409 });
  }

  
  if (body.action === "reorderExercises") {
    if (session.status !== "PLANNED" && session.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "Cannot reorder now" }, { status: 409 });
    }
    const ids = body.orderedProgramExerciseIds;
    if (!Array.isArray(ids) || !ids.every((x) => typeof x === "string")) {
      return NextResponse.json({ error: "orderedProgramExerciseIds must be string[]" }, { status: 400 });
    }
    const day = await prisma.programDay.findUnique({
      where: { id: session.programDayId },
      include: { exercises: { select: { id: true } } },
    });
    if (!day) return NextResponse.json({ error: "Day not found" }, { status: 404 });
    const expected = new Set(day.exercises.map((e) => e.id));
    if (ids.length !== expected.size) {
      return NextResponse.json({ error: "Order must include every exercise once" }, { status: 400 });
    }
    for (const id of ids) {
      if (!expected.has(id)) {
        return NextResponse.json({ error: "Unknown programExerciseId in order" }, { status: 400 });
      }
    }
    await prisma.workoutSession.update({
      where: { id: sessionId },
      data: { exerciseOrder: ids },
    });
    return NextResponse.json({ ok: true });
  }


  if (body.action === "readiness") {
    const m = readinessToIntensityScalar(body.sleep, body.stress, body.soreness);
    await prisma.$transaction([
      prisma.workoutSession.update({
        where: { id: sessionId },
        data: {
          sleep: body.sleep,
          stress: body.stress,
          soreness: body.soreness,
          intensityMultiplier: m,
          status: "IN_PROGRESS",
          ...(session.workoutStartedAt == null && { workoutStartedAt: new Date() }),
        },
      }),
      prisma.readinessEntry.upsert({
        where: { workoutSessionId: sessionId },
        create: {
          workoutSessionId: sessionId,
          sleep: body.sleep,
          stress: body.stress,
          soreness: body.soreness,
        },
        update: {
          sleep: body.sleep,
          stress: body.stress,
          soreness: body.soreness,
        },
      }),
    ]);
    await prefillPctWeightsForSession(sessionId, userId);
    await prefillHistoryWeightsForSession(sessionId, userId);
    return NextResponse.json({ ok: true, intensityMultiplier: m });
  }

  if (body.action === "set") {
    const data: Record<string, unknown> = {};
    if (body.weight !== undefined) data.weight = body.weight;
    if (body.weightUnit != null) data.weightUnit = body.weightUnit;
    if (body.reps !== undefined) data.reps = body.reps;
    if (body.rpe !== undefined) data.rpe = body.rpe;
    if (body.durationSec !== undefined) data.durationSec = body.durationSec;
    if (body.calories !== undefined) data.calories = body.calories;
    if (body.done != null) {
      data.done = body.done;
      data.completedAt = body.done ? new Date() : null;
    }
    await prisma.loggedSet.update({
      where: { id: body.setId },
      data,
    });
    if (body.done === true) {
      await mirrorWorkingWeightToRemainingSets(sessionId, body.setId, userId);
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "complete") {
    const withDay = await prisma.workoutSession.findUnique({
      where: { id: sessionId },
      include: { programDay: { select: { sortOrder: true } } },
    });
    if (!withDay?.programDay) {
      return NextResponse.json({ error: "Session day missing" }, { status: 500 });
    }
    const completedAt = new Date();
    await prisma.workoutSession.update({
      where: { id: sessionId },
      data: { status: "COMPLETED", workoutCompletedAt: completedAt },
    });
    const cursor = await syncProgramInstanceCursor(session.programInstanceId, userId);
    let summary: Awaited<ReturnType<typeof buildSessionCompletionSummary>>;
    try {
      summary = await buildSessionCompletionSummary(userId, sessionId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
    let weekSummary: Awaited<ReturnType<typeof buildWeekCompletionSummary>> | null = null;
    if (cursor.weekFullyAccounted) {
      weekSummary = await buildWeekCompletionSummary(
        userId,
        session.programInstanceId,
        session.weekIndex,
      );
    }
    return NextResponse.json({
      ok: true,
      summary,
      weekReadyToFinalize: cursor.weekFullyAccounted,
      weekSummary,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ sessionId: string }> },
) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { sessionId } = await ctx.params;

  const session = await prisma.workoutSession.findUnique({
    where: { id: sessionId },
    include: { programInstance: true },
  });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.programInstance.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (session.status !== "COMPLETED" && session.status !== "CANCELLED") {
    return NextResponse.json(
      { error: "Only completed or cancelled sessions can be deleted from history" },
      { status: 409 },
    );
  }

  await prisma.workoutSession.delete({ where: { id: sessionId } });
  return NextResponse.json({ ok: true });
}
