import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/require-user";
import { userCanViewProgram } from "@/lib/program-access";

export const dynamic = "force-dynamic";

const noStoreJson = { headers: { "Cache-Control": "private, no-store, max-age=0" } };

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ programId: string }> },
) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { programId } = await ctx.params;

  const program = await prisma.program.findUnique({ where: { id: programId } });
  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404, ...noStoreJson });
  }
  if (!userCanViewProgram(program.ownerId, userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404, ...noStoreJson });
  }

  try {
    const instance = await prisma.$transaction(async (tx) => {
      await tx.programInstance.updateMany({
        where: { status: "ACTIVE", userId },
        data: { status: "COMPLETED" },
      });
      return tx.programInstance.create({
        data: {
          userId,
          programId,
          status: "ACTIVE",
          weekIndex: 0,
          nextDaySortOrder: 0,
        },
      });
    });

    return NextResponse.json({ instance }, noStoreJson);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { ...noStoreJson, status: 500 });
  }
}
