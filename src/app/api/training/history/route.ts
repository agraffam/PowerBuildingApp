import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

const noStoreJson = { headers: { "Cache-Control": "private, no-store, max-age=0" } };

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

export async function GET(req: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { searchParams } = new URL(req.url);
  let limit = parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
  if (Number.isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
  limit = Math.min(limit, MAX_LIMIT);
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);

  try {
    const [items, total] = await Promise.all([
      prisma.workoutSession.findMany({
        where: {
          status: "COMPLETED",
          programInstance: { userId },
        },
        orderBy: { performedAt: "desc" },
        skip: offset,
        take: limit,
        select: {
          id: true,
          performedAt: true,
          weekIndex: true,
          programDay: { select: { label: true } },
          programInstance: {
            select: {
              programId: true,
              program: { select: { name: true } },
            },
          },
        },
      }),
      prisma.workoutSession.count({
        where: {
          status: "COMPLETED",
          programInstance: { userId },
        },
      }),
    ]);

    const sessions = items.map((s) => ({
      id: s.id,
      performedAt: s.performedAt.toISOString(),
      weekIndex: s.weekIndex,
      dayLabel: s.programDay.label,
      programId: s.programInstance.programId,
      programName: s.programInstance.program.name,
    }));

    return NextResponse.json(
      { sessions, total, limit, offset },
      noStoreJson,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { ...noStoreJson, status: 500 });
  }
}
