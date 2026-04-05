import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { isSuperAdminEmail } from "@/lib/auth/super-admin";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireSuperAdmin();
  if (gate instanceof NextResponse) return gate;

  const { id: targetId } = await ctx.params;
  if (!targetId) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  }

  if (targetId === gate.admin.id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, email: true },
  });

  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (isSuperAdminEmail(target.email)) {
    return NextResponse.json({ error: "The super-admin account cannot be deleted." }, { status: 400 });
  }

  await prisma.user.delete({ where: { id: targetId } });

  return NextResponse.json({ ok: true });
}
