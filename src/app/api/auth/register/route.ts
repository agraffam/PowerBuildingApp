import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendSessionCookieToResponse } from "@/lib/auth/session";
import { passwordFieldSchema } from "@/lib/auth/password-policy";
import { checkRateLimit, clientIpFromRequest, registerRateLimitConfig } from "@/lib/rate-limit";
import { isPrismaUniqueConstraintError } from "@/lib/prisma-unique-constraint";

const bodySchema = z.object({
  email: z.string().trim().email(),
  password: passwordFieldSchema,
  name: z.string().trim().max(80).optional(),
});

export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  const lim = registerRateLimitConfig();
  const rl = checkRateLimit(`register:${ip}`, lim.max, lim.windowMs);
  if (!rl.ok) {
    const res = NextResponse.json({ error: "Too many registration attempts. Try again later." }, { status: 429 });
    res.headers.set("Retry-After", String(rl.retryAfterSec));
    return res;
  }

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
  let user;
  try {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: parsed.data.name || null,
        settings: {
          create: {
            preferredWeightUnit: "LB",
            defaultRestSec: 180,
            plateIncrementLb: 2.5,
            plateIncrementKg: 2.5,
          },
        },
      },
    });
  } catch (e) {
    if (isPrismaUniqueConstraintError(e)) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }
    throw e;
  }

  const res = NextResponse.json(
    {
      user: { id: user.id, email: user.email, name: user.name },
    },
    { status: 201 },
  );
  await appendSessionCookieToResponse(res, user.id, req);
  return res;
}
