import {
  KG_PER_LB,
  brzyckiOneRm,
  displayFromKg,
  normalizeWeightToKg,
  type WeightUnit,
} from "@/lib/calculators";
import { prisma } from "@/lib/prisma";

export type MonthlyBoardEntry = {
  rank: number;
  userId: string;
  displayName: string;
  value: number;
};

export type Big3BoardColumn = {
  slug: string;
  label: string;
  entries: MonthlyBoardEntry[];
};

export type MonthlyBoardPayload = {
  monthLabel: string;
  /** Viewer preferred unit (used for Big 3 est. 1RM display). */
  displayUnit: WeightUnit;
  /** Best Brzycki est. 1RM per lift this calendar month (per user). */
  big3: Big3BoardColumn[];
  workouts: MonthlyBoardEntry[];
  volumeLb: MonthlyBoardEntry[];
  currentUserId: string;
  /** Users who completed at least one workout this month. */
  athleteCount: number;
};

const TOP_N = 10;

const BIG3_SPECS = [
  { slug: "squat", label: "Squat", exerciseSlugs: ["squat", "low-bar-squat"] },
  { slug: "bench-press", label: "Bench Press", exerciseSlugs: ["bench-press", "close-grip-bench"] },
  { slug: "deadlift", label: "Deadlift", exerciseSlugs: ["deadlift", "sumo-deadlift"] },
] as const;

/** Start/end of the calendar month in local time, plus a display label. */
export function getLocalCalendarMonthRange(now = new Date()): {
  start: Date;
  end: Date;
  monthLabel: string;
} {
  const y = now.getFullYear();
  const m = now.getMonth();
  const start = new Date(y, m, 1, 0, 0, 0, 0);
  const end = new Date(y, m + 1, 1, 0, 0, 0, 0);
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(start);
  return { start, end, monthLabel };
}

function sessionInMonthWhere(start: Date, end: Date) {
  return {
    status: "COMPLETED" as const,
    OR: [
      { workoutCompletedAt: { gte: start, lt: end } },
      { AND: [{ workoutCompletedAt: null }, { performedAt: { gte: start, lt: end } }] },
    ],
  };
}

function displayNameFromUser(name: string | null): string {
  const t = name?.trim();
  return t && t.length > 0 ? t : "Anonymous";
}

export async function buildMonthlyBoard(currentUserId: string): Promise<MonthlyBoardPayload> {
  const { start, end, monthLabel } = getLocalCalendarMonthRange();

  const viewerSettings = await prisma.userSettings.findUnique({
    where: { userId: currentUserId },
    select: { preferredWeightUnit: true },
  });
  const displayUnit: WeightUnit = viewerSettings?.preferredWeightUnit ?? "LB";

  const sessionRows = await prisma.workoutSession.findMany({
    where: sessionInMonthWhere(start, end),
    select: { id: true, programInstance: { select: { userId: true } } },
  });

  const workoutCounts = new Map<string, number>();
  const userBySessionId = new Map<string, string>();
  const sessionIds: string[] = [];
  for (const row of sessionRows) {
    sessionIds.push(row.id);
    const uid = row.programInstance.userId;
    userBySessionId.set(row.id, uid);
    workoutCounts.set(uid, (workoutCounts.get(uid) ?? 0) + 1);
  }

  const topWorkoutUserIds = [...workoutCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_N)
    .map(([id]) => id);

  const sets =
    sessionIds.length === 0
      ? []
      : await prisma.loggedSet.findMany({
          where: {
            workoutSessionId: { in: sessionIds },
            done: true,
            reps: { gt: 0 },
            weight: { gt: 0 },
          },
          select: {
            workoutSessionId: true,
            weight: true,
            weightUnit: true,
            reps: true,
          },
        });

  const volumeByUser = new Map<string, number>();
  for (const ls of sets) {
    const uid = userBySessionId.get(ls.workoutSessionId);
    if (!uid) continue;
    const lb = ls.weightUnit === "KG" ? ls.weight / KG_PER_LB : ls.weight;
    const add = lb * (ls.reps ?? 0);
    volumeByUser.set(uid, (volumeByUser.get(uid) ?? 0) + add);
  }

  const topVolumeUserIds = [...volumeByUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_N)
    .map(([id]) => id);

  const userIds = [...new Set([...topWorkoutUserIds, ...topVolumeUserIds])];
  const users =
    userIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        });
  const nameById = new Map(users.map((u) => [u.id, displayNameFromUser(u.name)]));

  const workouts: MonthlyBoardEntry[] = topWorkoutUserIds.map((userId, i) => ({
    rank: i + 1,
    userId,
    displayName: nameById.get(userId) ?? "Anonymous",
    value: workoutCounts.get(userId) ?? 0,
  }));

  const volumeLb: MonthlyBoardEntry[] = topVolumeUserIds.map((userId, i) => ({
    rank: i + 1,
    userId,
    displayName: nameById.get(userId) ?? "Anonymous",
    value: Math.round(volumeByUser.get(userId) ?? 0),
  }));

  const athleteIds = [...new Set(sessionRows.map((r) => r.programInstance.userId))];
  const athleteCount = athleteIds.length;

  const big3Exercises = await prisma.exercise.findMany({
    where: { slug: { in: [...new Set(BIG3_SPECS.flatMap((s) => s.exerciseSlugs))] } },
    select: { id: true, slug: true, name: true },
  });
  const groupSlugByExerciseSlug = new Map<string, string>();
  for (const spec of BIG3_SPECS) {
    for (const exSlug of spec.exerciseSlugs) {
      groupSlugByExerciseSlug.set(exSlug, spec.slug);
    }
  }
  const groupSlugByExerciseId = new Map(
    big3Exercises
      .map((e) => {
        const groupSlug = groupSlugByExerciseSlug.get(e.slug);
        return groupSlug ? ([e.id, groupSlug] as const) : null;
      })
      .filter((v): v is readonly [string, string] => v != null),
  );
  const big3Ids = [...groupSlugByExerciseId.keys()];

  const maxE1KgByGroupAndUser = new Map<string, Map<string, number>>();
  for (const spec of BIG3_SPECS) maxE1KgByGroupAndUser.set(spec.slug, new Map());

  if (sessionIds.length > 0 && big3Ids.length > 0) {
    const liftSets = await prisma.loggedSet.findMany({
      where: {
        workoutSessionId: { in: sessionIds },
        done: true,
        reps: { gt: 0 },
        weight: { gt: 0 },
        OR: [
          { programExercise: { exerciseId: { in: big3Ids } } },
          { loggedExerciseId: { in: big3Ids } },
        ],
      },
      select: {
        workoutSessionId: true,
        weight: true,
        weightUnit: true,
        reps: true,
        loggedExerciseId: true,
        programExercise: { select: { exerciseId: true } },
      },
    });

    for (const ls of liftSets) {
      const exerciseId = ls.loggedExerciseId ?? ls.programExercise.exerciseId;
      const groupSlug = groupSlugByExerciseId.get(exerciseId);
      if (!groupSlug) continue;
      const perUser = maxE1KgByGroupAndUser.get(groupSlug);
      if (!perUser) continue;
      const uid = userBySessionId.get(ls.workoutSessionId);
      if (!uid) continue;
      const e1 = brzyckiOneRm(ls.weight, ls.reps ?? 0);
      if (e1 == null) continue;
      const e1Kg = normalizeWeightToKg(e1, ls.weightUnit as WeightUnit);
      perUser.set(uid, Math.max(perUser.get(uid) ?? 0, e1Kg));
    }
  }

  const collectUserIdsForBig3 = new Set<string>();
  for (const spec of BIG3_SPECS) {
    const m = maxE1KgByGroupAndUser.get(spec.slug);
    if (!m) continue;
    const topUids = [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_N)
      .map(([uid]) => uid);
    for (const uid of topUids) collectUserIdsForBig3.add(uid);
  }

  const big3NameUsers =
    collectUserIdsForBig3.size === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: [...collectUserIdsForBig3] } },
          select: { id: true, name: true },
        });
  const big3NameById = new Map(big3NameUsers.map((u) => [u.id, displayNameFromUser(u.name)]));

  const big3: Big3BoardColumn[] = BIG3_SPECS.map((spec) => {
    const m = maxE1KgByGroupAndUser.get(spec.slug) ?? new Map();
    const topUserIds = [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_N)
      .map(([uid]) => uid);
    const entries: MonthlyBoardEntry[] = topUserIds.map((userId, i) => ({
      rank: i + 1,
      userId,
      displayName: big3NameById.get(userId) ?? nameById.get(userId) ?? "Anonymous",
      value: Math.round(displayFromKg(m.get(userId) ?? 0, displayUnit) * 10) / 10,
    }));
    return {
      slug: spec.slug,
      label: spec.label,
      entries,
    };
  });

  return {
    monthLabel,
    displayUnit,
    big3,
    workouts,
    volumeLb,
    currentUserId,
    athleteCount,
  };
}
