import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { advanceProgramInstance } from "@/lib/instance-advance";
import { requireUserId } from "@/lib/auth/require-user";

export async function POST(req: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const body = (await req.json()) as { instanceId?: string };
  const instanceId = body.instanceId;
  if (!instanceId) return NextResponse.json({ error: "instanceId required" }, { status: 400 });

  const instance = await prisma.programInstance.findUnique({ where: { id: instanceId } });
  if (!instance || instance.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pending = await prisma.workoutSession.findFirst({
    where: {
      programInstanceId: instanceId,
      status: { in: ["PLANNED", "IN_PROGRESS"] },
    },
  });
  if (pending) {
    return NextResponse.json({ error: "Finish or abandon in-progress session first" }, { status: 409 });
  }

  await advanceProgramInstance(instanceId, userId);
  const refreshed = await prisma.programInstance.findUnique({ where: { id: instanceId } });
  return NextResponse.json({ ok: true, instance: refreshed });
}
