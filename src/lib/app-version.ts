import { formatVersionTickerFromCount, getGitCommitCount } from "@/lib/git-commits";

let cachedVersion: string | null = null;

export function getAppVersionTicker(): string {
  if (cachedVersion) return cachedVersion;
  const fromEnv = process.env.NEXT_PUBLIC_APP_VERSION_TICKER?.trim();
  if (fromEnv) {
    cachedVersion = fromEnv;
    return cachedVersion;
  }
  const count = getGitCommitCount();
  cachedVersion = formatVersionTickerFromCount(count);
  return cachedVersion;
}
