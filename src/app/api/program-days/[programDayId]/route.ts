import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserContext } from "@/lib/auth/require-user";
import { userCanEditProgramIncludingAdmin } from "@/lib/program-access";

const patchSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ programDayId: string }> },
) {
  const auth = await requireUserContext();
  if (auth instanceof NextResponse) return auth;
  const { userId, email } = auth;

  const { programDayId } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }

  const day = await prisma.programDay.findUnique({
    where: { id: programDayId },
    include: { program: true },
  });
  if (!day) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!userCanEditProgramIncludingAdmin(day.program.ownerId, userId, email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (parsed.data.label === undefined) {
    return NextResponse.json({ error: "label required" }, { status: 400 });
  }

  await prisma.programDay.update({
    where: { id: programDayId },
    data: { label: parsed.data.label },
  });

  const fresh = await prisma.programDay.findUnique({
    where: { id: programDayId },
    include: {
      exercises: {
        orderBy: { sortOrder: "asc" },
        include: {
          exercise: { select: { id: true, name: true, slug: true, kind: true, isBodyweight: true } },
        },
      },
    },
  });

  return NextResponse.json({ programDay: fresh });
}
