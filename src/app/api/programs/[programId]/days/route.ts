import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserContext } from "@/lib/auth/require-user";
import { userCanEditProgramIncludingAdmin } from "@/lib/program-access";

const postSchema = z.object({
  label: z.string().trim().min(1).max(120),
});

export async function POST(req: Request, ctx: { params: Promise<{ programId: string }> }) {
  const auth = await requireUserContext();
  if (auth instanceof NextResponse) return auth;
  const { userId, email } = auth;

  const { programId } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }

  const program = await prisma.program.findUnique({
    where: { id: programId },
    include: { days: { orderBy: { sortOrder: "desc" }, take: 1 } },
  });
  if (!program) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!userCanEditProgramIncludingAdmin(program.ownerId, userId, email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const nextOrder = (program.days[0]?.sortOrder ?? -1) + 1;

  const day = await prisma.programDay.create({
    data: {
      programId,
      sortOrder: nextOrder,
      label: parsed.data.label,
    },
  });

  return NextResponse.json({ programDay: day });
}
