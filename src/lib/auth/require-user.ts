import { NextResponse } from "next/server";
import { readSessionUserId } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

/**
 * Returns user id or a 401 JSON response.
 * If the session JWT is valid but the user row is missing (e.g. DB wiped / new Docker volume), returns 401
 * so clients re-authenticate instead of hitting FK errors on UserSettings and similar.
 */
export async function requireUserId(): Promise<{ userId: string } | NextResponse> {
  const userId = await readSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { userId };
}
