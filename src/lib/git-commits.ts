import { execSync } from "node:child_process";
import { GENERATED_APP_VERSION, GENERATED_RELEASE_ENTRIES } from "@/lib/generated-release-data";

export type GitCommitEntry = {
  hash: string;
  date: string;
  subject: string;
  version: string;
};

function formatVersionFromCount(count: number): string {
  const safe = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  return `0.${String(safe).padStart(3, "0")}`;
}

function parseCommitCount(raw: string): number {
  const parsed = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function getGitCommitCount(): number {
  try {
    return parseCommitCount(execSync("git rev-list --count HEAD", { encoding: "utf8" }));
  } catch {
    const n = Number.parseInt(GENERATED_APP_VERSION.replace("0.", ""), 10);
    return Number.isFinite(n) ? n : 0;
  }
}

export function getGitCommitEntries(limit = 40): GitCommitEntry[] {
  const total = getGitCommitCount();
  if (total <= 0) return [];
  try {
    const raw = execSync(
      `git log -n ${Math.max(1, Math.floor(limit))} --date=short --pretty=format:%h\\|%ad\\|%s`,
      {
      encoding: "utf8",
      },
    ).trim();
    if (!raw) return [];
    return raw
      .split("\n")
      .map((line, idx) => {
        const [hash = "", date = "", subject = "Update"] = line.split("|");
        return {
          hash,
          date,
          subject,
          version: formatVersionFromCount(total - idx),
        };
      })
      .filter((entry) => entry.hash.length > 0);
  } catch {
    return GENERATED_RELEASE_ENTRIES.slice(0, Math.max(1, Math.floor(limit))).map((e) => ({
      hash: e.hash,
      date: e.date,
      subject: e.subject,
      version: e.version,
    }));
  }
}

export function formatVersionTickerFromCount(count: number): string {
  return formatVersionFromCount(count);
}
