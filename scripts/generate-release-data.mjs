import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function tryRun(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function versionFromCount(count) {
  const safe = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  return `0.${String(safe).padStart(3, "0")}`;
}

function cleanSubject(subject) {
  if (!subject) return "Update";
  return subject.replace(/\s+/g, " ").trim();
}

const outputPath = resolve(process.cwd(), "src/lib/generated-release-data.ts");
const countRaw = tryRun("git rev-list --count HEAD");
const raw = tryRun("git log -n 80 --date=short --pretty=format:%h\\|%ad\\|%s");

if (countRaw == null || raw == null) {
  if (existsSync(outputPath)) {
    const existing = readFileSync(outputPath, "utf8");
    writeFileSync(outputPath, existing, "utf8");
    console.log(`Git metadata unavailable; kept existing ${outputPath}.`);
    process.exit(0);
  }
}

const count = Number.parseInt(countRaw ?? "0", 10) || 0;
const lines = raw ? raw.split("\n") : [];

const entries = lines.map((line, idx) => {
  const [hash = "", date = "", subject = "Update"] = line.split("|");
  const cleaned = cleanSubject(subject);
  const detail = cleaned.includes(":") ? cleaned.split(":").slice(1).join(":").trim() : cleaned;
  return {
    hash,
    date,
    subject: cleaned,
    title: detail || cleaned,
    version: versionFromCount(count - idx),
  };
});

const out = `export type ReleaseEntry = {
  hash: string;
  date: string;
  version: string;
  subject: string;
  title: string;
};

/** Generated from git history by scripts/generate-release-data.mjs */
export const GENERATED_APP_VERSION = "${versionFromCount(count)}";

/** Newest first. */
export const GENERATED_RELEASE_ENTRIES: ReleaseEntry[] = ${JSON.stringify(entries, null, 2)} as const;
`;

writeFileSync(outputPath, out, "utf8");
console.log(`Wrote ${outputPath} with ${entries.length} entries.`);
