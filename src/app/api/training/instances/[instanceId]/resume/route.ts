import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/require-user";
import { userCanViewProgram } from "@/lib/program-access";

export const dynamic = "force-dynamic";

const noStoreJson = { headers: { "Cache-Control": "private, no-store, max-age=0" } };

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ instanceId: string }> },
) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { instanceId } = await ctx.params;

  const target = await prisma.programInstance.findUnique({
    where: { id: instanceId },
    include: { program: { select: { ownerId: true } } },
  });
  if (!target || target.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404, ...noStoreJson });
  }
  if (!userCanViewProgram(target.program.ownerId, userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404, ...noStoreJson });
  }
  if (target.status === "ACTIVE") {
    return NextResponse.json({ error: "That program is already active" }, { status: 409, ...noStoreJson });
  }
  if (target.status !== "PAUSED" && target.status !== "COMPLETED") {
    return NextResponse.json({ error: "Cannot resume this program run" }, { status: 409, ...noStoreJson });
  }

  try {
    const active = await prisma.$transaction(async (tx) => {
      await tx.programInstance.updateMany({
        where: { status: "ACTIVE", userId },
        data: { status: "PAUSED" },
      });
      return tx.programInstance.update({
        where: { id: instanceId },
        data: { status: "ACTIVE" },
      });
    });

    return NextResponse.json({ instance: active }, noStoreJson);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { ...noStoreJson, status: 500 });
  }
}
