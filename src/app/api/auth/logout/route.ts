import { NextResponse } from "next/server";
import { clearSessionCookieOnResponse } from "@/lib/auth/session";

export async function POST(req: Request) {
  const res = NextResponse.json({ ok: true });
  clearSessionCookieOnResponse(res, req);
  return res;
}
