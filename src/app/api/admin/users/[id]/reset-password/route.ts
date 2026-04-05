import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { passwordFieldSchema } from "@/lib/auth/password-policy";

const bodySchema = z.object({
  newPassword: passwordFieldSchema,
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const gate = await requireSuperAdmin();
  if (gate instanceof NextResponse) return gate;

  const { id: targetId } = await ctx.params;
  if (!targetId) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid password" },
      { status: 400 },
    );
  }

  const exists = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true },
  });

  if (!exists) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({
    where: { id: targetId },
    data: { passwordHash },
  });

  return NextResponse.json({ ok: true });
}
