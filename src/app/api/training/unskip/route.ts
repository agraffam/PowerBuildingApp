import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/require-user";
import { unskipProgramDayForInstance } from "@/lib/unskip-program-day";

const bodySchema = z.object({
  instanceId: z.string().min(1),
  programDayId: z.string().min(1),
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
    return NextResponse.json({ error: "instanceId and programDayId required" }, { status: 400 });
  }

  const { instanceId, programDayId } = parsed.data;

  try {
    await unskipProgramDayForInstance(instanceId, userId, programDayId);
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (code === "INVALID_DAY") return NextResponse.json({ error: "Invalid training day" }, { status: 400 });
    if (code === "ALREADY_DONE") {
      return NextResponse.json({ error: "That day is already completed this week." }, { status: 409 });
    }
    if (code === "SESSION_IN_PROGRESS") {
      return NextResponse.json(
        { error: "Finish or cancel your in-progress workout before changing skips." },
        { status: 409 },
      );
    }
    if (code === "NOT_SKIPPED") {
      return NextResponse.json({ error: "That day is not marked skipped this week." }, { status: 409 });
    }
    throw e;
  }

  const refreshed = await prisma.programInstance.findUnique({ where: { id: instanceId } });
  return NextResponse.json({ ok: true, instance: refreshed });
}
