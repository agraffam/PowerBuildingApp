import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/require-user";
import { sortedProgramDays, loadInstanceForWeekState } from "@/lib/program-week-state";
import { skipProgramDayForInstance } from "@/lib/skip-program-day";

const bodySchema = z.object({
  instanceId: z.string().min(1),
  programDayId: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "instanceId required" }, { status: 400 });
  }

  const { instanceId, programDayId: bodyDayId } = parsed.data;

  const instance = await loadInstanceForWeekState(instanceId, userId);
  if (!instance || instance.status !== "ACTIVE") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const daysSorted = sortedProgramDays(instance);
  let programDayId = bodyDayId;
  if (!programDayId) {
    const slot = daysSorted[instance.nextDaySortOrder];
    if (!slot) {
      return NextResponse.json({ error: "No day to skip" }, { status: 400 });
    }
    programDayId = slot.id;
  }

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

  const refreshed = await prisma.programInstance.findUnique({ where: { id: instanceId } });
  return NextResponse.json({ ok: true, instance: refreshed });
}
