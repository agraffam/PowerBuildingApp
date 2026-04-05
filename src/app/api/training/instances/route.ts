import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/require-user";
import { userCanViewProgram } from "@/lib/program-access";

export const dynamic = "force-dynamic";

const noStoreJson = { headers: { "Cache-Control": "private, no-store, max-age=0" } };

export async function GET() {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const rows = await prisma.programInstance.findMany({
    where: {
      userId,
      status: { in: ["PAUSED", "COMPLETED"] },
    },
    orderBy: { startedAt: "desc" },
    take: 25,
    include: {
      program: { select: { id: true, name: true, ownerId: true } },
      sessions: {
        orderBy: { performedAt: "desc" },
        take: 1,
        select: { performedAt: true },
      },
    },
  });

  const instances = rows
    .filter((r) => userCanViewProgram(r.program.ownerId, userId))
    .map((r) => ({
      id: r.id,
      programId: r.programId,
      programName: r.program.name,
      status: r.status,
      weekIndex: r.weekIndex,
      nextDaySortOrder: r.nextDaySortOrder,
      startedAt: r.startedAt.toISOString(),
      lastSessionAt: r.sessions[0]?.performedAt?.toISOString() ?? null,
    }));

  return NextResponse.json({ instances }, noStoreJson);
}
