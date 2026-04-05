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

  const row = await prisma.programInstance.findUnique({
    where: { id: instanceId },
    include: { program: { select: { ownerId: true } } },
  });
  if (!row || row.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404, ...noStoreJson });
  }
  if (!userCanViewProgram(row.program.ownerId, userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404, ...noStoreJson });
  }
  if (row.status === "ACTIVE") {
    return NextResponse.json(
      { error: "Switch to another program first, then you can end this paused run from the list." },
      { status: 409, ...noStoreJson },
    );
  }
  if (row.status === "ARCHIVED") {
    return NextResponse.json({ ok: true }, noStoreJson);
  }

  await prisma.programInstance.update({
    where: { id: instanceId },
    data: { status: "ARCHIVED" },
  });

  return NextResponse.json({ ok: true }, noStoreJson);
}
