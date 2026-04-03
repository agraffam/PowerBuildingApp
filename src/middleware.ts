import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as jose from "jose";
import { getJwtSecretKeyBytes } from "@/lib/auth/jwt-secret";

const COOKIE = "pb_session";

function isSafeRelativePath(next: string): boolean {
  return next.startsWith("/") && !next.startsWith("//");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE)?.value;
  let sessionValid = false;
  if (token) {
    try {
      await jose.jwtVerify(token, getJwtSecretKeyBytes(), { algorithms: ["HS256"] });
      sessionValid = true;
    } catch {
      sessionValid = false;
    }
  }

  const isAuthPage = pathname === "/login" || pathname === "/register";
  if (isAuthPage) {
    if (sessionValid) {
      const next = request.nextUrl.searchParams.get("next");
      const authPaths = new Set(["/login", "/register"]);
      const dest =
        next && isSafeRelativePath(next) && !authPaths.has(next.split("?")[0] ?? "")
          ? next
          : "/";
      return NextResponse.redirect(new URL(dest, request.url));
    }
    return NextResponse.next();
  }

  if (!sessionValid) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
