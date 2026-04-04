import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/require-user";
import { passwordFieldSchema } from "@/lib/auth/password-policy";

const patchSchema = z
  .object({
    name: z.string().trim().max(80).optional(),
    currentPassword: z.string().optional(),
    newPassword: passwordFieldSchema.optional(),
    email: z.string().trim().email().optional(),
  })
  .superRefine((data, ctx) => {
    const hasName = data.name !== undefined;
    const hasPw = data.newPassword !== undefined;
    const hasEmail = data.email !== undefined;
    if (!hasName && !hasPw && !hasEmail) {
      ctx.addIssue({
        code: "custom",
        message: "Provide name, newPassword, and/or email to update",
        path: [],
      });
    }
    if (hasPw && (data.currentPassword == null || data.currentPassword === "")) {
      ctx.addIssue({
        code: "custom",
        message: "Current password is required to set a new password",
        path: ["currentPassword"],
      });
    }
    if (hasEmail && (data.currentPassword == null || data.currentPassword === "")) {
      ctx.addIssue({
        code: "custom",
        message: "Current password is required to change email",
        path: ["currentPassword"],
      });
    }
  });

export async function GET() {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, email: true, name: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ user });
}

export async function PATCH(req: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const body = parsed.data;
  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (body.newPassword != null || body.email != null) {
    const current = body.currentPassword ?? "";
    const ok = await bcrypt.compare(current, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }
  }

  if (body.email != null) {
    const email = body.email.toLowerCase();
    const taken = await prisma.user.findFirst({
      where: { email, NOT: { id: user.id } },
      select: { id: true },
    });
    if (taken) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
  }

  const data: { name?: string | null; email?: string; passwordHash?: string } = {};
  if (body.name !== undefined) {
    data.name = body.name === "" ? null : body.name;
  }
  if (body.email != null) {
    data.email = body.email.toLowerCase();
  }
  if (body.newPassword != null) {
    data.passwordHash = await bcrypt.hash(body.newPassword, 10);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No updates applied" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: { id: true, email: true, name: true },
  });

  return NextResponse.json({ user: updated });
}
