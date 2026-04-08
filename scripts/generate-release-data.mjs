import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

function run(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

function versionFromCount(count) {
  const safe = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  return `0.${String(safe).padStart(3, "0")}`;
}

function cleanSubject(subject) {
  if (!subject) return "Update";
  return subject.replace(/\s+/g, " ").trim();
}

const count = Number.parseInt(run("git rev-list --count HEAD"), 10) || 0;
const raw = run("git log -n 80 --date=short --pretty=format:%h\\|%ad\\|%s");
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

const outputPath = resolve(process.cwd(), "src/lib/generated-release-data.ts");
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
