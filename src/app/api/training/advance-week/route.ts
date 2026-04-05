import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/require-user";
import { finalizeProgramWeek } from "@/lib/program-week-state";

export const dynamic = "force-dynamic";

const noStoreJson = { headers: { "Cache-Control": "private, no-store, max-age=0" } };

export async function POST(req: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  let instanceId: string | undefined;
  try {
    const raw = await req.json();
    if (raw && typeof raw === "object" && typeof (raw as { instanceId?: unknown }).instanceId === "string") {
      instanceId = (raw as { instanceId: string }).instanceId.trim();
    }
  } catch {
    /* empty */
  }
  if (!instanceId) {
    return NextResponse.json({ error: "instanceId required" }, { status: 400, ...noStoreJson });
  }

  const result = await finalizeProgramWeek(instanceId, userId);
  if (!result.ok) {
    if (result.error === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404, ...noStoreJson });
    }
    if (result.error === "WEEK_INCOMPLETE") {
      return NextResponse.json(
        { error: "Complete or skip every training day in this week first." },
        { status: 409, ...noStoreJson },
      );
    }
    return NextResponse.json({ error: "Cannot advance week" }, { status: 400, ...noStoreJson });
  }

  const refreshed = await prisma.programInstance.findUnique({ where: { id: instanceId } });

  return NextResponse.json(
    {
      ok: true,
      programCompleted: result.programCompleted,
      instance: refreshed,
    },
    noStoreJson,
  );
}
