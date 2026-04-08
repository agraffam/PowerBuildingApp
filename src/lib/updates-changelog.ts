export type AppUpdateEntry = {
  version: string;
  date: string;
  title: string;
  highlights: string[];
};

/**
 * Curated from git history to give users a readable product changelog.
 * Versions follow the in-app ticker style (0.xxx).
 */
export const APP_UPDATES: AppUpdateEntry[] = [
  {
    version: "0.036",
    date: "2026-04-08",
    title: "Workout logging polish",
    highlights: [
      "Kept target prescription text compact and easier to scan.",
      "Moved notes to exercise-level during sessions for cleaner logging.",
      "Improved notes visibility and set-note UX in workout flow.",
    ],
  },
  {
    version: "0.033",
    date: "2026-04-07",
    title: "Mobile workout usability",
    highlights: [
      "Tightened workout layout on narrow screens.",
      "Improved set logging interaction flow and strength-profile behavior.",
      "Added keep-awake preference persistence and simplified session UX.",
    ],
  },
  {
    version: "0.030",
    date: "2026-04-07",
    title: "Load propagation and navigation cleanup",
    highlights: [
      "Fixed load propagation when marking sets done.",
      "Decluttered header navigation and centralized links in Settings.",
    ],
  },
  {
    version: "0.028",
    date: "2026-04-06",
    title: "Program prescription upgrades",
    highlights: [
      "Rolled out block-aware prescriptions and deload interval behavior.",
      "Expanded cardio builder and conditioning targets (time and kcal).",
      "Completed client/API updates for block prescription system.",
    ],
  },
  {
    version: "0.025",
    date: "2026-04-06",
    title: "Admin, templates, and data workflows",
    highlights: [
      "Added admin template operations and broader catalog management.",
      "Improved seed reliability and idempotent startup behavior.",
      "Enhanced workout editing mid-session and bodyweight scopes.",
    ],
  },
  {
    version: "0.022",
    date: "2026-04-05",
    title: "Week control and account safety",
    highlights: [
      "Added admin panel with auth hardening improvements.",
      "Introduced manual week rollover with skipped-day handling.",
      "Improved run lifecycle actions (pause, resume, archive, activate).",
    ],
  },
  {
    version: "0.019",
    date: "2026-04-05",
    title: "Rest timer system",
    highlights: [
      "Added global rest timer with background alerts and notifications.",
      "Improved countdown audio cues for final seconds.",
      "Added rest timer configuration in Settings.",
    ],
  },
  {
    version: "0.016",
    date: "2026-04-04",
    title: "Programs and onboarding expansion",
    highlights: [
      "Added 15 home gym templates and broader seeded program catalog.",
      "Introduced account page and stronger authentication guardrails.",
      "Added explicit save patterns for settings, sets, and history dates.",
    ],
  },
  {
    version: "0.012",
    date: "2026-04-03",
    title: "Training flow improvements",
    highlights: [
      "Added RPE-based rest bands with grouped defaults.",
      "Introduced completion splash and week drag/reorder interactions.",
      "Expanded help content and training guidance.",
    ],
  },
  {
    version: "0.008",
    date: "2026-04-03",
    title: "Deployment and docs stabilization",
    highlights: [
      "Improved droplet deploy scripts and env handling.",
      "Documented GHCR and droplet deployment paths.",
      "Hardened startup behavior for Docker and Prisma workflows.",
    ],
  },
  {
    version: "0.002",
    date: "2026-04-02",
    title: "Initial launch",
    highlights: [
      "Shipped the first Powerbuild app foundation with Next.js and Prisma.",
    ],
  },
];
