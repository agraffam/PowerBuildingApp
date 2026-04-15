export type ReleaseEntry = {
  hash: string;
  date: string;
  version: string;
  subject: string;
  title: string;
};

/** Generated from git history by scripts/generate-release-data.mjs */
export const GENERATED_APP_VERSION = "0.060";

/** Newest first. */
export const GENERATED_RELEASE_ENTRIES: ReleaseEntry[] = [
  {
    "hash": "e01e44a",
    "date": "2026-04-15",
    "subject": "fix board lift grouping and tighten progression bumps",
    "title": "fix board lift grouping and tighten progression bumps",
    "version": "0.060"
  },
  {
    "hash": "165d24e",
    "date": "2026-04-14",
    "subject": "Move nav to header; Board in settings; Big 3 monthly board",
    "title": "Move nav to header; Board in settings; Big 3 monthly board",
    "version": "0.059"
  },
  {
    "hash": "0dfef1f",
    "date": "2026-04-14",
    "subject": "Set row: keep Done on same line as Set n (move Last time below)",
    "title": "keep Done on same line as Set n (move Last time below)",
    "version": "0.058"
  },
  {
    "hash": "8635c3b",
    "date": "2026-04-14",
    "subject": "Workout: fix initial scroll after readiness/warmup; compact exercise meta row",
    "title": "fix initial scroll after readiness/warmup; compact exercise meta row",
    "version": "0.057"
  },
  {
    "hash": "a42470e",
    "date": "2026-04-14",
    "subject": "Fix workout scroll: baseline top, transition-only auto-collapse",
    "title": "baseline top, transition-only auto-collapse",
    "version": "0.056"
  },
  {
    "hash": "9263ab7",
    "date": "2026-04-14",
    "subject": "Workout UI: history-only sheet, More menu for history/notes",
    "title": "history-only sheet, More menu for history/notes",
    "version": "0.055"
  },
  {
    "hash": "756ca89",
    "date": "2026-04-14",
    "subject": "Mobile-first shell, shared PageHeader, and test fixes",
    "title": "Mobile-first shell, shared PageHeader, and test fixes",
    "version": "0.054"
  },
  {
    "hash": "1ae53c2",
    "date": "2026-04-14",
    "subject": "fix(ui): show last session set ghost on same row as set number",
    "title": "show last session set ghost on same row as set number",
    "version": "0.053"
  },
  {
    "hash": "969e6ff",
    "date": "2026-04-14",
    "subject": "fix(training): weight +/- layout and smaller step buttons",
    "title": "weight +/- layout and smaller step buttons",
    "version": "0.052"
  },
  {
    "hash": "0d4e834",
    "date": "2026-04-14",
    "subject": "feat(training): add quick increment controls for set weight",
    "title": "add quick increment controls for set weight",
    "version": "0.051"
  },
  {
    "hash": "327590d",
    "date": "2026-04-13",
    "subject": "feat(training): RPE rest ladder, scroll, week PRs, cardio mm:ss, progression ceil, add set",
    "title": "RPE rest ladder, scroll, week PRs, cardio mm:ss, progression ceil, add set",
    "version": "0.050"
  },
  {
    "hash": "7189aa8",
    "date": "2026-04-10",
    "subject": "refactor(train): remove per-day skip; keep skip on Up next card",
    "title": "remove per-day skip; keep skip on Up next card",
    "version": "0.049"
  },
  {
    "hash": "2bbdf28",
    "date": "2026-04-10",
    "subject": "feat(training): unskip days, skipDay from session, safer skip UX",
    "title": "unskip days, skipDay from session, safer skip UX",
    "version": "0.048"
  },
  {
    "hash": "995538f",
    "date": "2026-04-08",
    "subject": "feat: monthly Board (workouts + volume lb)",
    "title": "monthly Board (workouts + volume lb)",
    "version": "0.047"
  },
  {
    "hash": "c6dc1b1",
    "date": "2026-04-08",
    "subject": "feat: pre-workout warmup after readiness; bodyweight program seeds",
    "title": "pre-workout warmup after readiness; bodyweight program seeds",
    "version": "0.046"
  },
  {
    "hash": "42e75b8",
    "date": "2026-04-08",
    "subject": "fix(training): enforce week progression via completion modal",
    "title": "enforce week progression via completion modal",
    "version": "0.045"
  },
  {
    "hash": "f931bdc",
    "date": "2026-04-08",
    "subject": "fix(analytics): render selected tracked lifts by name",
    "title": "render selected tracked lifts by name",
    "version": "0.044"
  },
  {
    "hash": "76b12fa",
    "date": "2026-04-08",
    "subject": "fix(analytics): normalize tracked exercise IDs to display names",
    "title": "normalize tracked exercise IDs to display names",
    "version": "0.043"
  },
  {
    "hash": "cff74fd",
    "date": "2026-04-08",
    "subject": "fix(build): make release metadata generation docker-safe",
    "title": "make release metadata generation docker-safe",
    "version": "0.042"
  },
  {
    "hash": "f23d643",
    "date": "2026-04-08",
    "subject": "feat: expand analytics tracking and stabilize version/update metadata",
    "title": "expand analytics tracking and stabilize version/update metadata",
    "version": "0.041"
  },
  {
    "hash": "fa8e562",
    "date": "2026-04-08",
    "subject": "feat: auto-generate updates and add admin last-session metadata",
    "title": "auto-generate updates and add admin last-session metadata",
    "version": "0.040"
  },
  {
    "hash": "79a21fd",
    "date": "2026-04-08",
    "subject": "feat: ship workout UX updates, review pages, and changelog",
    "title": "ship workout UX updates, review pages, and changelog",
    "version": "0.039"
  },
  {
    "hash": "9d61546",
    "date": "2026-04-08",
    "subject": "fix(ui): keep target prescription on one compact line",
    "title": "keep target prescription on one compact line",
    "version": "0.038"
  },
  {
    "hash": "a3191b1",
    "date": "2026-04-08",
    "subject": "feat(workout): move notes to exercise-level during session",
    "title": "move notes to exercise-level during session",
    "version": "0.037"
  },
  {
    "hash": "478ff0b",
    "date": "2026-04-08",
    "subject": "fix(ui): make set notes action clearly visible",
    "title": "make set notes action clearly visible",
    "version": "0.036"
  },
  {
    "hash": "354f101",
    "date": "2026-04-07",
    "subject": "feat(workout): per-set notes with dialog and API persistence",
    "title": "per-set notes with dialog and API persistence",
    "version": "0.035"
  },
  {
    "hash": "3887a41",
    "date": "2026-04-07",
    "subject": "fix(ui): tighten workout layout on narrow screens",
    "title": "tighten workout layout on narrow screens",
    "version": "0.034"
  },
  {
    "hash": "4cb1477",
    "date": "2026-04-07",
    "subject": "fix: propagate updated load when logging sets as done",
    "title": "propagate updated load when logging sets as done",
    "version": "0.033"
  },
  {
    "hash": "63f6109",
    "date": "2026-04-07",
    "subject": "fix: declutter header navigation and centralize app links in settings",
    "title": "declutter header navigation and centralize app links in settings",
    "version": "0.032"
  },
  {
    "hash": "6e2601a",
    "date": "2026-04-07",
    "subject": "fix: simplify end-user UX and persist workout keep-awake preference",
    "title": "simplify end-user UX and persist workout keep-awake preference",
    "version": "0.031"
  },
  {
    "hash": "029a5d6",
    "date": "2026-04-07",
    "subject": "fix: streamline workout logging interactions and strength profile scope",
    "title": "streamline workout logging interactions and strength profile scope",
    "version": "0.030"
  },
  {
    "hash": "8c7de6c",
    "date": "2026-04-06",
    "subject": "fix: catalog admin for super-admin, cardio builder UX, prune images after deploy",
    "title": "catalog admin for super-admin, cardio builder UX, prune images after deploy",
    "version": "0.029"
  },
  {
    "hash": "12e7ce0",
    "date": "2026-04-06",
    "subject": "fix: cardio catalog UX, seed kind backfill, help for mesocycles",
    "title": "cardio catalog UX, seed kind backfill, help for mesocycles",
    "version": "0.028"
  },
  {
    "hash": "a3fc737",
    "date": "2026-04-06",
    "subject": "feat(ui): finish block prescription rollout in client and APIs",
    "title": "finish block prescription rollout in client and APIs",
    "version": "0.027"
  },
  {
    "hash": "08877ce",
    "date": "2026-04-06",
    "subject": "feat: block-aware prescriptions, deload intervals, and seed updates",
    "title": "block-aware prescriptions, deload intervals, and seed updates",
    "version": "0.026"
  },
  {
    "hash": "8b21cb3",
    "date": "2026-04-06",
    "subject": "Blueprint: bike erg + assault conditioning use time and kcal targets",
    "title": "bike erg + assault conditioning use time and kcal targets",
    "version": "0.025"
  },
  {
    "hash": "2853e81",
    "date": "2026-04-06",
    "subject": "Docker: prisma db push --accept-data-loss for schema upgrades",
    "title": "prisma db push --accept-data-loss for schema upgrades",
    "version": "0.024"
  },
  {
    "hash": "795f6a5",
    "date": "2026-04-06",
    "subject": "Fix Docker droplet startup: chown SQLite volume before prisma",
    "title": "chown SQLite volume before prisma",
    "version": "0.023"
  },
  {
    "hash": "3f26999",
    "date": "2026-04-06",
    "subject": "Improve droplet deploy script diagnostics after Docker prune",
    "title": "Improve droplet deploy script diagnostics after Docker prune",
    "version": "0.022"
  },
  {
    "hash": "098e29e",
    "date": "2026-04-06",
    "subject": "feat: admin templates, idempotent seed, notes, BW scopes, cardio, mid-flight edits",
    "title": "admin templates, idempotent seed, notes, BW scopes, cardio, mid-flight edits",
    "version": "0.021"
  },
  {
    "hash": "c671493",
    "date": "2026-04-06",
    "subject": "Programs: delete owned templates, reorder exercises in builder",
    "title": "delete owned templates, reorder exercises in builder",
    "version": "0.020"
  },
  {
    "hash": "fe3c429",
    "date": "2026-04-05",
    "subject": "Admin panel, auth hardening, manual week rollover with skips",
    "title": "Admin panel, auth hardening, manual week rollover with skips",
    "version": "0.019"
  },
  {
    "hash": "405c2cd",
    "date": "2026-04-05",
    "subject": "Seed: rename template programs, add 60-min powerbuilding blueprint",
    "title": "rename template programs, add 60-min powerbuilding blueprint",
    "version": "0.018"
  },
  {
    "hash": "8bc62e4",
    "date": "2026-04-05",
    "subject": "Programs: end run (ARCHIVED), dedupe resume list, archive on resume/activate",
    "title": "end run (ARCHIVED), dedupe resume list, archive on resume/activate",
    "version": "0.017"
  },
  {
    "hash": "93a63a2",
    "date": "2026-04-05",
    "subject": "Programs: pause on switch, resume, confirm dialog; workout RPE select and auto-collapse",
    "title": "pause on switch, resume, confirm dialog; workout RPE select and auto-collapse",
    "version": "0.016"
  },
  {
    "hash": "b3826be",
    "date": "2026-04-05",
    "subject": "Describe what you changed in plain English",
    "title": "Describe what you changed in plain English",
    "version": "0.015"
  },
  {
    "hash": "22d1ada",
    "date": "2026-04-05",
    "subject": "feat: louder rest countdown beeps at 3s, 2s, and 1s sustain",
    "title": "louder rest countdown beeps at 3s, 2s, and 1s sustain",
    "version": "0.014"
  },
  {
    "hash": "aade4ff",
    "date": "2026-04-05",
    "subject": "feat: global rest timer, background alerts, Settings notifications",
    "title": "global rest timer, background alerts, Settings notifications",
    "version": "0.013"
  },
  {
    "hash": "a4f212d",
    "date": "2026-04-04",
    "subject": "feat: rest timer beep, RPE band settings, persist rest, bodyweight lifts",
    "title": "rest timer beep, RPE band settings, persist rest, bodyweight lifts",
    "version": "0.012"
  },
  {
    "hash": "f5818ac",
    "date": "2026-04-04",
    "subject": "fix: run Prisma seed via npx tsx (Docker PATH)",
    "title": "run Prisma seed via npx tsx (Docker PATH)",
    "version": "0.011"
  },
  {
    "hash": "b774a6a",
    "date": "2026-04-04",
    "subject": "Add 15 home gym program templates to seed (6–16 weeks)",
    "title": "Add 15 home gym program templates to seed (6–16 weeks)",
    "version": "0.010"
  },
  {
    "hash": "d85e46d",
    "date": "2026-04-04",
    "subject": "Add account page, Tier A auth hardening, and security e2e",
    "title": "Add account page, Tier A auth hardening, and security e2e",
    "version": "0.009"
  },
  {
    "hash": "278ab80",
    "date": "2026-04-04",
    "subject": "UX: numeric inputs + explicit save for sets, settings, history date",
    "title": "numeric inputs + explicit save for sets, settings, history date",
    "version": "0.008"
  },
  {
    "hash": "1b07d44",
    "date": "2026-04-03",
    "subject": "RPE rest: 30–210s steps, grouped defaults 60/120/180, defaultRestSec 180",
    "title": "30–210s steps, grouped defaults 60/120/180, defaultRestSec 180",
    "version": "0.007"
  },
  {
    "hash": "8b211ad",
    "date": "2026-04-03",
    "subject": "deploy-droplet-pull: source .env for AUTH_SECRET/PB_IMAGE checks",
    "title": "source .env for AUTH_SECRET/PB_IMAGE checks",
    "version": "0.006"
  },
  {
    "hash": "c118922",
    "date": "2026-04-03",
    "subject": "Training UX: RPE rest, completion splash, week DnD, help; remove OCI docs",
    "title": "RPE rest, completion splash, week DnD, help; remove OCI docs",
    "version": "0.005"
  },
  {
    "hash": "d527b05",
    "date": "2026-04-03",
    "subject": "docs: DigitalOcean droplet with prebuilt GHCR image",
    "title": "DigitalOcean droplet with prebuilt GHCR image",
    "version": "0.004"
  },
  {
    "hash": "dffe2d8",
    "date": "2026-04-03",
    "subject": "docs: point GIT_DEPLOY at agraffam/PowerBuildingApp and auth options",
    "title": "point GIT_DEPLOY at agraffam/PowerBuildingApp and auth options",
    "version": "0.003"
  },
  {
    "hash": "15f6591",
    "date": "2026-04-03",
    "subject": "Powerbuild app: Next.js, Prisma, Docker, docs, OCI/Git deploy",
    "title": "Next.js, Prisma, Docker, docs, OCI/Git deploy",
    "version": "0.002"
  },
  {
    "hash": "a4641dd",
    "date": "2026-04-02",
    "subject": "feat: initial commit",
    "title": "initial commit",
    "version": "0.001"
  }
] as const;
