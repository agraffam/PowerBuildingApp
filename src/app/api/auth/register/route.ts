import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendSessionCookieToResponse } from "@/lib/auth/session";

const bodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().trim().max(80).optional(),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: parsed.data.name || null,
      settings: {
        create: {
          preferredWeightUnit: "LB",
          defaultRestSec: 120,
          plateIncrementLb: 2.5,
          plateIncrementKg: 2.5,
        },
      },
    },
  });

  const res = NextResponse.json(
    {
      user: { id: user.id, email: user.email, name: user.name },
    },
    { status: 201 },
  );
  await appendSessionCookieToResponse(res, user.id, req);
  return res;
}
