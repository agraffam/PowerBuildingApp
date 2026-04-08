import { formatVersionTickerFromCount, getGitCommitCount } from "@/lib/git-commits";
import { GENERATED_APP_VERSION } from "@/lib/generated-release-data";

let cachedVersion: string | null = null;

export function getAppVersionTicker(): string {
  if (cachedVersion) return cachedVersion;
  const fromEnv = process.env.NEXT_PUBLIC_APP_VERSION_TICKER?.trim();
  if (fromEnv) {
    cachedVersion = fromEnv;
    return cachedVersion;
  }
  const count = getGitCommitCount();
  cachedVersion = count > 0 ? formatVersionTickerFromCount(count) : GENERATED_APP_VERSION;
  return cachedVersion;
}
