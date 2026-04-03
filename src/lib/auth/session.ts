import { cookies, headers } from "next/headers";
import type { NextResponse } from "next/server";
import * as jose from "jose";
import { getJwtSecretKeyBytes } from "@/lib/auth/jwt-secret";

const COOKIE = "pb_session";
const TTL_SEC = 60 * 60 * 24 * 30; // 30 days

/**
 * Browsers ignore Set-Cookie with Secure=true on http:// (common: iPhone → LAN IP + Docker with NODE_ENV=production).
 * Use HTTPS termination headers when behind a proxy; override with SESSION_COOKIE_SECURE=true|false if needed.
 */
export function isSessionCookieSecureFromHeaders(h: Headers, requestUrl?: string): boolean {
  const explicit = process.env.SESSION_COOKIE_SECURE;
  if (explicit === "true" || explicit === "1") return true;
  if (explicit === "false" || explicit === "0") return false;

  const forwarded = h.get("x-forwarded-proto");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim().toLowerCase();
    if (first === "https") return true;
    if (first === "http") return false;
  }

  if (requestUrl) {
    try {
      if (new URL(requestUrl).protocol === "https:") return true;
    } catch {
      /* ignore */
    }
  }

  return false;
}

export async function isSessionCookieSecure(): Promise<boolean> {
  const h = await headers();
  return isSessionCookieSecureFromHeaders(h);
}

export async function signSessionToken(userId: string): Promise<string> {
  return new jose.SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SEC}s`)
    .sign(getJwtSecretKeyBytes());
}

export async function readSessionUserId(): Promise<string | null> {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE)?.value;
    if (!token) return null;
    const { payload } = await jose.jwtVerify(token, getJwtSecretKeyBytes(), {
      algorithms: ["HS256"],
    });
    const sub = payload.sub;
    return typeof sub === "string" ? sub : null;
  } catch {
    return null;
  }
}

/** Prefer this in Route Handlers so Set-Cookie is attached to the JSON response (more reliable on mobile Safari). */
export async function appendSessionCookieToResponse(
  res: NextResponse,
  userId: string,
  req: Request,
): Promise<void> {
  const token = await signSessionToken(userId);
  const secure = isSessionCookieSecureFromHeaders(req.headers, req.url);
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SEC,
  });
}

export function clearSessionCookieOnResponse(res: NextResponse, req: Request): void {
  const secure = isSessionCookieSecureFromHeaders(req.headers, req.url);
  res.cookies.set(COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function setSessionCookie(userId: string): Promise<void> {
  const token = await signSessionToken(userId);
  const jar = await cookies();
  const secure = await isSessionCookieSecure();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SEC,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  const secure = await isSessionCookieSecure();
  jar.set(COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
