import { KG_PER_LB } from "@/lib/calculators";
import { prisma } from "@/lib/prisma";

export type MonthlyBoardEntry = {
  rank: number;
  userId: string;
  displayName: string;
  value: number;
};

export type MonthlyBoardPayload = {
  monthLabel: string;
  workouts: MonthlyBoardEntry[];
  volumeLb: MonthlyBoardEntry[];
  currentUserId: string;
};

const TOP_N = 10;

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

  return {
    monthLabel,
    workouts,
    volumeLb,
    currentUserId,
  };
}
