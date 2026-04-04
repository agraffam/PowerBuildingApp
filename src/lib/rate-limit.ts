type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();

function disabled(): boolean {
  return (
    process.env.AUTH_RATE_LIMIT_DISABLED === "1" ||
    process.env.AUTH_RATE_LIMIT_DISABLED === "true"
  );
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw == null || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Max attempts per window (default: login 30 / 15 min). */
export function loginRateLimitConfig(): { max: number; windowMs: number } {
  return {
    max: parsePositiveInt(process.env.AUTH_RATE_LIMIT_LOGIN_MAX, 30),
    windowMs: parsePositiveInt(process.env.AUTH_RATE_LIMIT_LOGIN_WINDOW_MS, 900_000),
  };
}

/** Max registrations per window (default: 10 / hour). */
export function registerRateLimitConfig(): { max: number; windowMs: number } {
  return {
    max: parsePositiveInt(process.env.AUTH_RATE_LIMIT_REGISTER_MAX, 10),
    windowMs: parsePositiveInt(process.env.AUTH_RATE_LIMIT_REGISTER_WINDOW_MS, 3_600_000),
  };
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

/**
 * Fixed-window counter (in-memory). Safe for a single Node instance; use a shared store if you scale horizontally.
 */
export function checkRateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  if (disabled()) return { ok: true };

  const now = Date.now();
  let e = buckets.get(key);
  if (!e || now >= e.resetAt) {
    e = { count: 0, resetAt: now + windowMs };
    buckets.set(key, e);
  }
  e.count += 1;
  if (e.count > max) {
    const retryAfterSec = Math.max(1, Math.ceil((e.resetAt - now) / 1000));
    return { ok: false, retryAfterSec };
  }
  return { ok: true };
}

export function clientIpFromRequest(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}
