import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";

const projectDir = process.cwd();
loadEnvConfig(projectDir);

/** Match browser Origin hostname (see next/server/lib/router-utils/block-cross-site). */
function normalizeDevOriginHost(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const lower = t.toLowerCase();
  try {
    if (lower.includes("://")) {
      return new URL(lower).hostname.toLowerCase();
    }
    const forUrl = lower.includes(":") ? `http://${lower}` : `http://${lower}`;
    return new URL(forUrl).hostname.toLowerCase();
  } catch {
    return lower.split(":")[0] ?? lower;
  }
}

const allowedLanDevOrigins =
  process.env.ALLOWED_DEV_ORIGINS?.split(/[,]+/)
    .map(normalizeDevOriginHost)
    .filter(Boolean) ?? [];

const nextConfig: NextConfig = {
  ...(allowedLanDevOrigins.length > 0 ? { allowedDevOrigins: allowedLanDevOrigins } : {}),
};

export default nextConfig;
