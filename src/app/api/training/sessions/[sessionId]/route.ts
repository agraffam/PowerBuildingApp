import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionDetail } from "@/lib/training-queries";
import { readinessToIntensityScalar } from "@/lib/calculators";
import { syncProgramInstanceCursor } from "@/lib/program-week-state";
import { buildWeekCompletionSummary } from "@/lib/week-completion-summary";
import {
  mirrorWorkingWeightToRemainingSets,
  mirrorSetRpeRepsToFollowingUncompletedSets,
  mirrorSetWeightToFollowingUncompletedSets,
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
import { skipProgramDayForInstance } from "@/lib/skip-program-day";
import { resolveProgramExercisePrescription } from "@/lib/block-prescription";
import { getAppVersionTicker } from "@/lib/app-version";

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

  const progFull = session.programInstance.program;
  const programDayWithRx = {
    ...programDayEnriched,
    exercises: programDayEnriched.exercises.map((pe) => ({
      ...pe,
      prescription: resolveProgramExercisePrescription({
        programExercise: {
          sets: pe.sets,
          repTarget: pe.repTarget,
          targetRpe: pe.targetRpe,
          pctOf1rm: pe.pctOf1rm,
          restSec: pe.restSec,
          targetDurationSec: pe.targetDurationSec,
          targetCalories: pe.targetCalories,
          loadRole: pe.loadRole,
        },
        exerciseKind: pe.exercise.kind,
        autoBlockPrescriptions: progFull.autoBlockPrescriptions,
        deloadIntervalWeeks: progFull.deloadIntervalWeeks,
        blocks: progFull.blocks,
        instanceWeekIndex: session.weekIndex,
        periodizationStyle:
          (progFull as { periodizationStyle?: "LINEAR" | "ALTERNATING" | "UNDULATING" })
            .periodizationStyle ?? "LINEAR",
      }),
    })),
  };

  const sessionOut = {
    ...session,
    programDay: programDayWithRx,
    programId: session.programInstance.programId,
  };

  const prog = session.programInstance.program;
  const canEditProgramRest = userCanEditProgramIncludingAdmin(prog.ownerId, userId, email);
  const exerciseIds = programDayWithRx.exercises
    .filter((pe) => pe.exercise.kind === "STRENGTH" && pe.exercise.isBodyweight !== true)
    .map((pe) => pe.exercise.id);
  const strengthProfiles = exerciseIds.length
    ? await prisma.userStrengthProfile.findMany({
        where: {
          userId,
          exerciseId: { in: [...new Set(exerciseIds)] },
        },
        select: {
          exerciseId: true,
          estimatedOneRm: true,
          weightUnit: true,
        },
      })
    : [];
  const strengthProfileByExerciseId = Object.fromEntries(
    strengthProfiles.map((row) => [
      row.exerciseId,
      { estimatedOneRm: row.estimatedOneRm, weightUnit: row.weightUnit },
    ]),
  );

  return NextResponse.json({
    session: sessionOut,
    settings,
    previousByExerciseId: prevObj,
    displayUnit,
    canEditProgramRest,
    appVersion: getAppVersionTicker(),
    strengthProfileByExerciseId,
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

  if (body.action === "skipDay") {
    if (session.status !== "PLANNED" && session.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "Session cannot be marked skipped" }, { status: 409 });
    }
    const instanceId = session.programInstanceId;
    const programDayId = session.programDayId;
    try {
      await skipProgramDayForInstance(instanceId, userId, programDayId);
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      if (code === "NOT_FOUND") return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (code === "INVALID_DAY") return NextResponse.json({ error: "Invalid training day" }, { status: 400 });
      if (code === "ALREADY_DONE") {
        return NextResponse.json({ error: "That day is already completed this week." }, { status: 409 });
      }
      if (code === "SESSION_IN_PROGRESS") {
        return NextResponse.json(
          { error: "Finish or cancel your in-progress workout before skipping." },
          { status: 409 },
        );
      }
      throw e;
    }
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
    if (body.notes !== undefined) data.notes = body.notes === "" ? null : body.notes;
    if (body.done != null) {
      data.done = body.done;
      data.completedAt = body.done ? new Date() : null;
    }
    await prisma.loggedSet.update({
      where: { id: row.id },
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

  if (body.action === "setExerciseNotes") {
    if (session.status !== "PLANNED" && session.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "Cannot edit exercise notes now" }, { status: 409 });
    }
    const pe = await prisma.programExercise.findFirst({
      where: { id: body.programExerciseId, programDayId: session.programDayId },
      select: { id: true },
    });
    if (!pe) return NextResponse.json({ error: "Exercise not found in this workout" }, { status: 404 });
    await prisma.programExercise.update({
      where: { id: body.programExerciseId },
      data: { notes: body.notes === "" ? null : body.notes },
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

  if (body.action === "addSet") {
    const full = await prisma.workoutSession.findUnique({
      where: { id: sessionId },
      include: {
        programInstance: {
          include: { program: { include: { blocks: { orderBy: { sortOrder: "asc" } } } } },
        },
        sets: { where: { programExerciseId: body.programExerciseId } },
      },
    });
    if (!full || full.programInstance.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (full.status !== "PLANNED" && full.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "Cannot add set now" }, { status: 409 });
    }
    const pe = await prisma.programExercise.findFirst({
      where: { id: body.programExerciseId, programDayId: full.programDayId },
      include: { exercise: true },
    });
    if (!pe) return NextResponse.json({ error: "Exercise not found in this workout" }, { status: 404 });
    const dayExercises = await prisma.programExercise.findMany({
      where: { programDayId: full.programDayId },
      orderBy: { sortOrder: "asc" },
      include: { exercise: true },
    });
    let targets = [pe];
    if (pe.supersetGroup) {
      const idx = dayExercises.findIndex((x) => x.id === pe.id);
      if (idx >= 0) {
        let start = idx;
        let end = idx;
        while (start - 1 >= 0 && dayExercises[start - 1]?.supersetGroup === pe.supersetGroup) start--;
        while (end + 1 < dayExercises.length && dayExercises[end + 1]?.supersetGroup === pe.supersetGroup) end++;
        targets = dayExercises.slice(start, end + 1);
      }
    }

    const { sessionMap, instanceMap } = await loadSwapMapsForSession(sessionId, full.programInstanceId);
    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    const unit = settings?.preferredWeightUnit ?? "LB";
    for (const target of targets) {
      const eff = resolveEffectiveFromMaps(target.id, target.exerciseId, sessionMap, instanceMap);
      const loggedExerciseId = eff !== target.exerciseId ? eff : undefined;
      const maxIdx = await prisma.loggedSet.aggregate({
        where: { workoutSessionId: sessionId, programExerciseId: target.id },
        _max: { setIndex: true },
      });
      const nextIdx = (maxIdx._max.setIndex ?? -1) + 1;
      const rx = resolveProgramExercisePrescription({
        programExercise: {
          sets: target.sets,
          repTarget: target.repTarget,
          targetRpe: target.targetRpe,
          pctOf1rm: target.pctOf1rm,
          restSec: target.restSec,
          targetDurationSec: target.targetDurationSec,
          targetCalories: target.targetCalories,
          loadRole: target.loadRole,
        },
        exerciseKind: target.exercise.kind,
        autoBlockPrescriptions: full.programInstance.program.autoBlockPrescriptions,
        deloadIntervalWeeks: full.programInstance.program.deloadIntervalWeeks,
        blocks: full.programInstance.program.blocks,
        instanceWeekIndex: full.weekIndex,
        periodizationStyle:
          (full.programInstance.program as { periodizationStyle?: "LINEAR" | "ALTERNATING" | "UNDULATING" })
            .periodizationStyle ?? "LINEAR",
      });
      const cardio = target.exercise.kind === "CARDIO";
      await prisma.loggedSet.create({
        data: {
          workoutSessionId: sessionId,
          programExerciseId: target.id,
          loggedExerciseId,
          setIndex: nextIdx,
          weight: 0,
          weightUnit: unit,
          reps: cardio ? null : rx.repTarget,
          rpe: cardio ? null : rx.targetRpe,
          durationSec: cardio ? rx.targetDurationSec : null,
          calories: cardio ? rx.targetCalories ?? null : null,
          done: false,
        },
      });
    }
    await prefillPctWeightsForSession(sessionId, userId);
    await prefillHistoryWeightsForSession(sessionId, userId);
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
    if (body.notes !== undefined) data.notes = body.notes === "" ? null : body.notes;
    if (body.done != null) {
      data.done = body.done;
      data.completedAt = body.done ? new Date() : null;
    }
    await prisma.loggedSet.update({
      where: { id: row.id },
      data,
    });
    if (body.propagateWeight === true) {
      await mirrorSetWeightToFollowingUncompletedSets(sessionId, body.setId, userId);
    }
    if (body.propagateRpeReps === true) {
      await mirrorSetRpeRepsToFollowingUncompletedSets(sessionId, body.setId, userId);
    }
    if (body.done === true) {
      await mirrorWorkingWeightToRemainingSets(sessionId, body.setId, userId);
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "complete") {
    const [doneSets, totalSets] = await Promise.all([
      prisma.loggedSet.count({ where: { workoutSessionId: sessionId, done: true } }),
      prisma.loggedSet.count({ where: { workoutSessionId: sessionId } }),
    ]);
    if (doneSets === 0) {
      return NextResponse.json({ error: "Log at least one set before completing the session." }, { status: 409 });
    }
    if (doneSets < totalSets && body.allowPartial !== true) {
      return NextResponse.json(
        { error: "Some sets are incomplete. Confirm partial completion to continue.", code: "PARTIAL_CONFIRM_REQUIRED" },
        { status: 409 },
      );
    }
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
