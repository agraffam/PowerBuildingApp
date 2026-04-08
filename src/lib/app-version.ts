import { execSync } from "node:child_process";

let cachedVersion: string | null = null;

function formatVersionFromCount(count: number): string {
  const safe = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  return `0.${String(safe).padStart(3, "0")}`;
}

export function getAppVersionTicker(): string {
  if (cachedVersion) return cachedVersion;
  const fromEnv = process.env.NEXT_PUBLIC_APP_VERSION_TICKER?.trim();
  if (fromEnv) {
    cachedVersion = fromEnv;
    return cachedVersion;
  }
  try {
    const out = execSync("git rev-list --count HEAD", { encoding: "utf8" }).trim();
    const count = Number.parseInt(out, 10);
    cachedVersion = formatVersionFromCount(count);
    return cachedVersion;
  } catch {
    cachedVersion = "0.000";
    return cachedVersion;
  }
}
