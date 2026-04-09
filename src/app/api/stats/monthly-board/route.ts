import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/require-user";
import { buildMonthlyBoard } from "@/lib/monthly-board";

export const dynamic = "force-dynamic";

const noStoreJson = { headers: { "Cache-Control": "private, no-store, max-age=0" } };

export async function GET() {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;

  const payload = await buildMonthlyBoard(auth.userId);
  return NextResponse.json(payload, noStoreJson);
}
