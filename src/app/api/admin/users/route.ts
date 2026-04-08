import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";

export async function GET() {
  const gate = await requireSuperAdmin();
  if (gate instanceof NextResponse) return gate;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          programInstances: true,
          strengthProfiles: true,
        },
      },
    },
  });

  const completedSessions = await prisma.workoutSession.findMany({
    where: { status: "COMPLETED" },
    select: {
      performedAt: true,
      programInstance: {
        select: {
          userId: true,
        },
      },
    },
  });
  const sessionsByUser = new Map<string, number>();
  const lastLoggedAtByUser = new Map<string, Date>();
  for (const row of completedSessions) {
    const uid = row.programInstance.userId;
    sessionsByUser.set(uid, (sessionsByUser.get(uid) ?? 0) + 1);
    const prev = lastLoggedAtByUser.get(uid);
    if (!prev || row.performedAt > prev) lastLoggedAtByUser.set(uid, row.performedAt);
  }
  const usersWithSessions = users.map((u) => ({
    ...u,
    sessionsCompleted: sessionsByUser.get(u.id) ?? 0,
    lastLoggedSessionAt: lastLoggedAtByUser.get(u.id)?.toISOString() ?? null,
  }));

  return NextResponse.json({ users: usersWithSessions });
}
