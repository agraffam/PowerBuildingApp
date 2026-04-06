import { PrismaClient, BlockType, type Prisma, WeightUnit, type ExerciseKind } from "@prisma/client";
import bcrypt from "bcryptjs";
import { homeGymProgramCreateData } from "./home-gym-seed-programs";
import { powerbuildingBlueprintProgramCreateData } from "./powerbuilding-blueprint-seed";

const prisma = new PrismaClient();

const SEED_EMAIL = "dev@seed.local";
const SEED_PASSWORD = "Seed12345678";

const CARDIO_SLUGS = new Set(["bike-erg", "assault-runner-intervals"]);

async function ensureExerciseDef(def: { name: string; slug: string; muscleTags: string }) {
  const wantKind: ExerciseKind = CARDIO_SLUGS.has(def.slug) ? "CARDIO" : "STRENGTH";
  const existing = await prisma.exercise.findUnique({ where: { slug: def.slug } });
  if (existing) {
    const data: { kind?: ExerciseKind; isBodyweight?: boolean } = {};
    if (existing.kind !== wantKind) data.kind = wantKind;
    if (wantKind === "CARDIO" && existing.isBodyweight) data.isBodyweight = false;
    if (Object.keys(data).length > 0) {
      return prisma.exercise.update({ where: { id: existing.id }, data });
    }
    return existing;
  }
  return prisma.exercise.create({
    data: {
      name: def.name,
      slug: def.slug,
      muscleTags: def.muscleTags,
      kind: wantKind,
    },
  });
}

function stripSeedKeyForCreate(data: Prisma.ProgramCreateInput & { seedKey: string }): Prisma.ProgramCreateInput {
  const { seedKey: _s, ...rest } = data;
  void _s;
  return rest;
}

/** Idempotent template install: never delete programs with instances; do not overwrite existing rows. */
async function ensureSeededProgram(data: Prisma.ProgramCreateInput & { seedKey: string }) {
  const seedKey = data.seedKey;
  const createPayload = stripSeedKeyForCreate(data);
  const byKey = await prisma.program.findUnique({ where: { seedKey } });
  if (byKey) {
    const n = await prisma.programInstance.count({ where: { programId: byKey.id } });
    console.log(
      `Seed: skip ${seedKey}${typeof createPayload.name === "string" ? ` (${createPayload.name})` : ""} — exists${n ? `, ${n} program run(s)` : ""}.`,
    );
    return byKey;
  }
  const legacyName = typeof data.name === "string" ? data.name : null;
  if (legacyName) {
    const legacy = await prisma.program.findFirst({
      where: { ownerId: null, seedKey: null, name: legacyName },
    });
    if (legacy) {
      await prisma.program.update({
        where: { id: legacy.id },
        data: { seedKey },
      });
      console.log(`Seed: linked existing template "${legacyName}" → ${seedKey}.`);
      return prisma.program.findUniqueOrThrow({ where: { id: legacy.id } });
    }
  }
  const merged: Prisma.ProgramCreateInput = {
    ...createPayload,
    deloadIntervalWeeks: createPayload.deloadIntervalWeeks ?? 5,
    autoBlockPrescriptions: createPayload.autoBlockPrescriptions ?? true,
  };
  return prisma.program.create({
    data: {
      ...merged,
      seedKey,
    },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  const seedUser = await prisma.user.upsert({
    where: { email: SEED_EMAIL },
    create: {
      email: SEED_EMAIL,
      passwordHash,
      name: "Dev seed",
      settings: {
        create: {
          preferredWeightUnit: WeightUnit.LB,
          defaultRestSec: 180,
          plateIncrementLb: 2.5,
          plateIncrementKg: 2.5,
        },
      },
    },
    update: {},
  });
  if (!(await prisma.userSettings.findUnique({ where: { userId: seedUser.id } }))) {
    await prisma.userSettings.create({
      data: {
        userId: seedUser.id,
        preferredWeightUnit: WeightUnit.LB,
        defaultRestSec: 180,
        plateIncrementLb: 2.5,
        plateIncrementKg: 2.5,
      },
    });
  }
  console.log("Seed user:", SEED_EMAIL, "/", SEED_PASSWORD);

  const exerciseDefs = [
    { name: "Competition Bench Press", slug: "bench-press", muscleTags: "chest,triceps,shoulders" },
    { name: "Back Squat", slug: "squat", muscleTags: "quads,glutes,back" },
    { name: "Conventional Deadlift", slug: "deadlift", muscleTags: "posterior,back,glutes" },
    { name: "Overhead Press", slug: "overhead-press", muscleTags: "shoulders,triceps" },
    { name: "Barbell Row", slug: "barbell-row", muscleTags: "back,biceps" },
    { name: "Romanian Deadlift", slug: "romanian-deadlift", muscleTags: "hamstrings,glutes,back" },
    { name: "Lat Pulldown", slug: "lat-pulldown", muscleTags: "lats,biceps" },
    { name: "Leg Press", slug: "leg-press", muscleTags: "quads" },
    { name: "Leg Curl", slug: "leg-curl", muscleTags: "hamstrings" },
    { name: "Leg Extension", slug: "leg-extension", muscleTags: "quads" },
    { name: "Cable Fly", slug: "cable-fly", muscleTags: "chest" },
    { name: "Lateral Raise", slug: "lateral-raise", muscleTags: "shoulders" },
    { name: "Triceps Pushdown", slug: "triceps-pushdown", muscleTags: "triceps" },
    { name: "Barbell Curl", slug: "barbell-curl", muscleTags: "biceps" },
    { name: "Calf Raise", slug: "calf-raise", muscleTags: "calves" },
    { name: "Pull-Up", slug: "pull-up", muscleTags: "lats,biceps,back" },
    { name: "Chin-Up", slug: "chin-up", muscleTags: "lats,biceps,back" },
    { name: "Chest Dip", slug: "chest-dip", muscleTags: "chest,triceps" },
    { name: "Triceps Dip", slug: "triceps-dip", muscleTags: "triceps,chest" },
    { name: "Dumbbell Bench Press", slug: "dumbbell-bench-press", muscleTags: "chest,triceps" },
    { name: "Incline Barbell Bench", slug: "incline-barbell-bench", muscleTags: "chest,shoulders,triceps" },
    { name: "Incline Dumbbell Press", slug: "incline-dumbbell-press", muscleTags: "chest,shoulders" },
    { name: "Front Squat", slug: "front-squat", muscleTags: "quads,core,back" },
    { name: "Hack Squat", slug: "hack-squat", muscleTags: "quads" },
    { name: "Goblet Squat", slug: "goblet-squat", muscleTags: "quads,core" },
    { name: "Bulgarian Split Squat", slug: "bulgarian-split-squat", muscleTags: "quads,glutes" },
    { name: "Walking Lunge", slug: "walking-lunge", muscleTags: "quads,glutes" },
    { name: "Hip Thrust", slug: "hip-thrust", muscleTags: "glutes,hamstrings" },
    { name: "Glute Bridge", slug: "glute-bridge", muscleTags: "glutes" },
    { name: "Sumo Deadlift", slug: "sumo-deadlift", muscleTags: "posterior,glutes,back" },
    { name: "Rack Pull", slug: "rack-pull", muscleTags: "back,posterior,traps" },
    { name: "T-Bar Row", slug: "t-bar-row", muscleTags: "back,biceps" },
    { name: "Chest-Supported Row", slug: "chest-supported-row", muscleTags: "back,biceps" },
    { name: "Seated Cable Row", slug: "seated-cable-row", muscleTags: "back,biceps" },
    { name: "Cable Lateral Raise", slug: "cable-lateral-raise", muscleTags: "shoulders" },
    { name: "Rear Delt Fly", slug: "rear-delt-fly", muscleTags: "shoulders,back" },
    { name: "Face Pull", slug: "face-pull", muscleTags: "rear-delts,upper-back" },
    { name: "Skullcrusher", slug: "skullcrusher", muscleTags: "triceps" },
    { name: "Overhead Triceps Extension", slug: "overhead-triceps-extension", muscleTags: "triceps" },
    { name: "Hammer Curl", slug: "hammer-curl", muscleTags: "biceps,forearms" },
    { name: "Preacher Curl", slug: "preacher-curl", muscleTags: "biceps" },
    { name: "Concentration Curl", slug: "concentration-curl", muscleTags: "biceps" },
    { name: "Pendlay Row", slug: "pendlay-row", muscleTags: "back,biceps" },
    { name: "Barbell Shrugs", slug: "barbell-shrugs", muscleTags: "traps" },
    { name: "Machine Chest Press", slug: "machine-chest-press", muscleTags: "chest,triceps" },
    { name: "Pec Deck", slug: "pec-deck", muscleTags: "chest" },
    { name: "Smith Machine Squat", slug: "smith-squat", muscleTags: "quads,glutes" },
    { name: "Step-Up", slug: "step-up", muscleTags: "quads,glutes" },
    { name: "Nordic Hamstring Curl", slug: "nordic-hamstring-curl", muscleTags: "hamstrings" },
    { name: "Cable Crunch", slug: "cable-crunch", muscleTags: "core" },
    { name: "Hanging Knee Raise", slug: "hanging-knee-raise", muscleTags: "core" },
    { name: "Ab Wheel Rollout", slug: "ab-wheel-rollout", muscleTags: "core" },
    { name: "Landmine Press", slug: "landmine-press", muscleTags: "shoulders,chest" },
    { name: "Arnold Press", slug: "arnold-press", muscleTags: "shoulders" },
    { name: "Close-Grip Bench Press", slug: "close-grip-bench", muscleTags: "triceps,chest" },
    { name: "Pause Squat", slug: "pause-squat", muscleTags: "quads,glutes" },
    { name: "Deficit Deadlift", slug: "deficit-deadlift", muscleTags: "posterior,back" },
    { name: "Pin Press", slug: "pin-press", muscleTags: "chest,triceps,lockout" },
    { name: "Low Bar Back Squat", slug: "low-bar-squat", muscleTags: "quads,glutes,back" },
    { name: "BikeErg", slug: "bike-erg", muscleTags: "conditioning,cardio" },
    { name: "Hanging Leg Raise", slug: "hanging-leg-raise", muscleTags: "core" },
    { name: "Alternating Dumbbell Curl", slug: "alternating-dumbbell-curl", muscleTags: "biceps" },
    { name: "Cable Straight-Bar Curl", slug: "cable-straight-bar-curl", muscleTags: "biceps" },
    { name: "Dumbbell Shrug", slug: "dumbbell-shrug", muscleTags: "traps" },
    { name: "Neutral-Grip Pull-Up", slug: "neutral-grip-pull-up", muscleTags: "lats,biceps,back" },
    { name: "Assault Runner (Intervals)", slug: "assault-runner-intervals", muscleTags: "conditioning,cardio" },
  ];

  const exercises: Record<string, string> = {};
  for (const e of exerciseDefs) {
    const row = await ensureExerciseDef(e);
    exercises[e.slug] = row.id;
  }

  /**
   * Prebuilt templates: idempotent via seedKey. Re-running seed does not delete programs
   * (avoids cascade-wiping program instances) and does not overwrite existing exercises.
   */
  const blocks8 = {
    create: [
      { blockType: BlockType.HYPERTROPHY, sortOrder: 0, startWeek: 1, endWeek: 4 },
      { blockType: BlockType.STRENGTH, sortOrder: 1, startWeek: 5, endWeek: 8 },
    ],
  };

  const E = exercises;

  // 1) StrongLifts-style linear 5×5: two alternating workouts (typical 2–4×/wk).
  const programs = [];

  programs.push(
    await ensureSeededProgram({
      seedKey: "seed-linear-5x5-2day",
      name: "Linear 5×5 — 2 day A/B",
      durationWeeks: 12,
      blocks: { create: blocks8.create },
      days: {
        create: [
          {
            sortOrder: 0,
            label: "Workout A — Squat / Bench / Row",
            exercises: {
              create: [
                { exerciseId: E["squat"]!, sortOrder: 0, sets: 5, repTarget: 5, targetRpe: 7.5, pctOf1rm: 76, restSec: 210 },
                { exerciseId: E["bench-press"]!, sortOrder: 1, sets: 5, repTarget: 5, targetRpe: 7.5, pctOf1rm: 76, restSec: 180 },
                { exerciseId: E["barbell-row"]!, sortOrder: 2, sets: 5, repTarget: 5, targetRpe: 7.5, pctOf1rm: 74, restSec: 180 },
              ],
            },
          },
          {
            sortOrder: 1,
            label: "Workout B — Squat / OHP / Deadlift",
            exercises: {
              create: [
                { exerciseId: E["squat"]!, sortOrder: 0, sets: 5, repTarget: 5, targetRpe: 7.5, pctOf1rm: 76, restSec: 210 },
                { exerciseId: E["overhead-press"]!, sortOrder: 1, sets: 5, repTarget: 5, targetRpe: 7.5, pctOf1rm: 72, restSec: 180 },
                { exerciseId: E["deadlift"]!, sortOrder: 2, sets: 1, repTarget: 5, targetRpe: 8, pctOf1rm: 82, restSec: 240 },
              ],
            },
          },
        ],
      },
    }),
  );

  // 2) Three full-body rotations (common Mon/Wed/Fri style; works with 2–6×/wk spacing).
  programs.push(
    await ensureSeededProgram({
      seedKey: "seed-full-body-3-templates",
      name: "Full Body — 3 templates",
      durationWeeks: 8,
      blocks: { create: blocks8.create },
      days: {
        create: [
            {
              sortOrder: 0,
              label: "Full Body 1 — Squat & push",
              exercises: {
                create: [
                  { exerciseId: E["squat"]!, sortOrder: 0, sets: 4, repTarget: 6, targetRpe: 8, pctOf1rm: 78, restSec: 200 },
                  { exerciseId: E["bench-press"]!, sortOrder: 1, sets: 3, repTarget: 8, targetRpe: 8, pctOf1rm: 74, restSec: 150 },
                  { exerciseId: E["barbell-row"]!, sortOrder: 2, sets: 3, repTarget: 8, targetRpe: 8, restSec: 120 },
                  { exerciseId: E["leg-curl"]!, sortOrder: 3, sets: 2, repTarget: 12, targetRpe: 9, restSec: 75 },
                  { exerciseId: E["lateral-raise"]!, sortOrder: 4, sets: 2, repTarget: 15, targetRpe: 9, restSec: 60 },
                ],
              },
            },
            {
              sortOrder: 1,
              label: "Full Body 2 — Hinge & pull",
              exercises: {
                create: [
                  { exerciseId: E["deadlift"]!, sortOrder: 0, sets: 3, repTarget: 5, targetRpe: 8, pctOf1rm: 80, restSec: 240 },
                  { exerciseId: E["overhead-press"]!, sortOrder: 1, sets: 3, repTarget: 6, targetRpe: 8, pctOf1rm: 76, restSec: 150 },
                  { exerciseId: E["lat-pulldown"]!, sortOrder: 2, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                  { exerciseId: E["bulgarian-split-squat"]!, sortOrder: 3, sets: 2, repTarget: 10, targetRpe: 8, restSec: 90 },
                  { exerciseId: E["barbell-curl"]!, sortOrder: 4, sets: 2, repTarget: 12, targetRpe: 9, restSec: 60 },
                ],
              },
            },
            {
              sortOrder: 2,
              label: "Full Body 3 — Legs & upper mix",
              exercises: {
                create: [
                  { exerciseId: E["front-squat"]!, sortOrder: 0, sets: 3, repTarget: 6, targetRpe: 8, restSec: 180 },
                  { exerciseId: E["incline-barbell-bench"]!, sortOrder: 1, sets: 3, repTarget: 8, targetRpe: 8, restSec: 120 },
                  { exerciseId: E["seated-cable-row"]!, sortOrder: 2, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                  { exerciseId: E["romanian-deadlift"]!, sortOrder: 3, sets: 3, repTarget: 8, targetRpe: 8, restSec: 120 },
                  { exerciseId: E["triceps-pushdown"]!, sortOrder: 4, sets: 2, repTarget: 12, targetRpe: 9, restSec: 60 },
                  { exerciseId: E["calf-raise"]!, sortOrder: 5, sets: 3, repTarget: 15, targetRpe: 9, restSec: 45 },
                ],
              },
            },
        ],
      },
    }),
  );

  // 3) PHUL-style powerbuilding: 4-day upper/lower (typical 4×/wk; 2×/wk = alternate pair).
  programs.push(
    await ensureSeededProgram({
      seedKey: "seed-powerbuilding-4d-ul",
      name: "Powerbuilding — 4-Day Upper/Lower",
      durationWeeks: 8,
      blocks: { create: blocks8.create },
      days: {
        create: [
            {
              sortOrder: 0,
              label: "Upper — Strength emphasis",
              exercises: {
                create: [
                  { exerciseId: E["bench-press"]!, sortOrder: 0, sets: 4, repTarget: 5, targetRpe: 8, pctOf1rm: 82, restSec: 200 },
                  { exerciseId: E["pendlay-row"]!, sortOrder: 1, sets: 4, repTarget: 5, targetRpe: 8, pctOf1rm: 78, restSec: 180 },
                  { exerciseId: E["overhead-press"]!, sortOrder: 2, sets: 3, repTarget: 6, targetRpe: 8, restSec: 150 },
                  { exerciseId: E["lat-pulldown"]!, sortOrder: 3, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                  { exerciseId: E["lateral-raise"]!, sortOrder: 4, sets: 3, repTarget: 12, targetRpe: 9, restSec: 60 },
                  { exerciseId: E["triceps-pushdown"]!, sortOrder: 5, sets: 3, repTarget: 12, targetRpe: 9, restSec: 60 },
                ],
              },
            },
            {
              sortOrder: 1,
              label: "Lower — Squat emphasis",
              exercises: {
                create: [
                  { exerciseId: E["squat"]!, sortOrder: 0, sets: 4, repTarget: 5, targetRpe: 8, pctOf1rm: 82, restSec: 220 },
                  { exerciseId: E["romanian-deadlift"]!, sortOrder: 1, sets: 3, repTarget: 6, targetRpe: 8, restSec: 150 },
                  { exerciseId: E["leg-press"]!, sortOrder: 2, sets: 3, repTarget: 10, targetRpe: 8, restSec: 120 },
                  { exerciseId: E["leg-curl"]!, sortOrder: 3, sets: 3, repTarget: 12, targetRpe: 9, restSec: 75 },
                  { exerciseId: E["calf-raise"]!, sortOrder: 4, sets: 4, repTarget: 12, targetRpe: 9, restSec: 60 },
                ],
              },
            },
            {
              sortOrder: 2,
              label: "Upper — Volume / accessories",
              exercises: {
                create: [
                  { exerciseId: E["incline-dumbbell-press"]!, sortOrder: 0, sets: 4, repTarget: 8, targetRpe: 8, restSec: 120 },
                  { exerciseId: E["chest-supported-row"]!, sortOrder: 1, sets: 4, repTarget: 10, targetRpe: 8, restSec: 90 },
                  { exerciseId: E["arnold-press"]!, sortOrder: 2, sets: 3, repTarget: 10, targetRpe: 9, restSec: 90 },
                  { exerciseId: E["face-pull"]!, sortOrder: 3, sets: 3, repTarget: 15, targetRpe: 9, restSec: 60 },
                  { exerciseId: E["cable-fly"]!, sortOrder: 4, sets: 3, repTarget: 12, targetRpe: 9, restSec: 60 },
                  { exerciseId: E["hammer-curl"]!, sortOrder: 5, sets: 3, repTarget: 12, targetRpe: 9, restSec: 60 },
                  { exerciseId: E["skullcrusher"]!, sortOrder: 6, sets: 3, repTarget: 10, targetRpe: 9, restSec: 75 },
                ],
              },
            },
            {
              sortOrder: 3,
              label: "Lower — Hinge & pump",
              exercises: {
                create: [
                  { exerciseId: E["deadlift"]!, sortOrder: 0, sets: 3, repTarget: 4, targetRpe: 8.5, pctOf1rm: 84, restSec: 240 },
                  { exerciseId: E["hack-squat"]!, sortOrder: 1, sets: 3, repTarget: 8, targetRpe: 8, restSec: 120 },
                  { exerciseId: E["leg-extension"]!, sortOrder: 2, sets: 3, repTarget: 12, targetRpe: 9, restSec: 60 },
                  { exerciseId: E["hip-thrust"]!, sortOrder: 3, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                  { exerciseId: E["leg-curl"]!, sortOrder: 4, sets: 3, repTarget: 12, targetRpe: 9, restSec: 60 },
                  { exerciseId: E["walking-lunge"]!, sortOrder: 5, sets: 2, repTarget: 10, targetRpe: 8, restSec: 90 },
                ],
              },
            },
        ],
      },
    }),
  );

  // 4) Classic bodybuilding split — 5 sessions (chest/back/legs/shoulders/arms).
  programs.push(
    await ensureSeededProgram({
      seedKey: "seed-bodybuilding-5d",
      name: "Bodybuilding — 5-Day Split",
      durationWeeks: 8,
      blocks: { create: blocks8.create },
      days: {
        create: [
            {
              sortOrder: 0,
              label: "Chest & triceps",
              exercises: {
                create: [
                  { exerciseId: E["incline-barbell-bench"]!, sortOrder: 0, sets: 4, repTarget: 8, targetRpe: 8, restSec: 120 },
                  { exerciseId: E["bench-press"]!, sortOrder: 1, sets: 3, repTarget: 8, targetRpe: 8, restSec: 120 },
                  { exerciseId: E["cable-fly"]!, sortOrder: 2, sets: 3, repTarget: 12, targetRpe: 9, restSec: 60 },
                  { exerciseId: E["pec-deck"]!, sortOrder: 3, sets: 3, repTarget: 15, targetRpe: 9, restSec: 60 },
                  { exerciseId: E["skullcrusher"]!, sortOrder: 4, sets: 3, repTarget: 10, targetRpe: 9, restSec: 75 },
                  { exerciseId: E["triceps-pushdown"]!, sortOrder: 5, sets: 3, repTarget: 12, targetRpe: 9, restSec: 60 },
                ],
              },
            },
            {
              sortOrder: 1,
              label: "Back & biceps",
              exercises: {
                create: [
                  { exerciseId: E["pull-up"]!, sortOrder: 0, sets: 4, repTarget: 8, targetRpe: 8, restSec: 120 },
                  { exerciseId: E["chest-supported-row"]!, sortOrder: 1, sets: 4, repTarget: 8, targetRpe: 8, restSec: 90 },
                  { exerciseId: E["lat-pulldown"]!, sortOrder: 2, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                  { exerciseId: E["seated-cable-row"]!, sortOrder: 3, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                  { exerciseId: E["face-pull"]!, sortOrder: 4, sets: 3, repTarget: 15, targetRpe: 9, restSec: 60 },
                  { exerciseId: E["barbell-curl"]!, sortOrder: 5, sets: 3, repTarget: 10, targetRpe: 9, restSec: 60 },
                  { exerciseId: E["hammer-curl"]!, sortOrder: 6, sets: 3, repTarget: 12, targetRpe: 9, restSec: 60 },
                ],
              },
            },
            {
              sortOrder: 2,
              label: "Legs — quads & posterior",
              exercises: {
                create: [
                  { exerciseId: E["squat"]!, sortOrder: 0, sets: 4, repTarget: 8, targetRpe: 8, pctOf1rm: 76, restSec: 200 },
                  { exerciseId: E["leg-press"]!, sortOrder: 1, sets: 3, repTarget: 12, targetRpe: 8, restSec: 120 },
                  { exerciseId: E["leg-extension"]!, sortOrder: 2, sets: 3, repTarget: 15, targetRpe: 9, restSec: 60 },
                  { exerciseId: E["romanian-deadlift"]!, sortOrder: 3, sets: 3, repTarget: 10, targetRpe: 8, restSec: 120 },
                  { exerciseId: E["leg-curl"]!, sortOrder: 4, sets: 4, repTarget: 12, targetRpe: 9, restSec: 60 },
                  { exerciseId: E["calf-raise"]!, sortOrder: 5, sets: 4, repTarget: 15, targetRpe: 9, restSec: 45 },
                ],
              },
            },
            {
              sortOrder: 3,
              label: "Shoulders",
              exercises: {
                create: [
                  { exerciseId: E["overhead-press"]!, sortOrder: 0, sets: 4, repTarget: 8, targetRpe: 8, restSec: 150 },
                  { exerciseId: E["arnold-press"]!, sortOrder: 1, sets: 3, repTarget: 10, targetRpe: 9, restSec: 90 },
                  { exerciseId: E["lateral-raise"]!, sortOrder: 2, sets: 4, repTarget: 15, targetRpe: 9, restSec: 60 },
                  { exerciseId: E["cable-lateral-raise"]!, sortOrder: 3, sets: 3, repTarget: 15, targetRpe: 9, restSec: 60 },
                  { exerciseId: E["rear-delt-fly"]!, sortOrder: 4, sets: 3, repTarget: 15, targetRpe: 9, restSec: 60 },
                  { exerciseId: E["barbell-shrugs"]!, sortOrder: 5, sets: 3, repTarget: 12, targetRpe: 9, restSec: 75 },
                ],
              },
            },
            {
              sortOrder: 4,
              label: "Arms (superset-style volume)",
              exercises: {
                create: [
                  { exerciseId: E["barbell-curl"]!, sortOrder: 0, sets: 4, repTarget: 10, targetRpe: 9, restSec: 60 },
                  { exerciseId: E["preacher-curl"]!, sortOrder: 1, sets: 3, repTarget: 12, targetRpe: 9, restSec: 60 },
                  { exerciseId: E["concentration-curl"]!, sortOrder: 2, sets: 2, repTarget: 12, targetRpe: 9, restSec: 60 },
                  { exerciseId: E["close-grip-bench"]!, sortOrder: 3, sets: 3, repTarget: 8, targetRpe: 8, restSec: 120 },
                  { exerciseId: E["skullcrusher"]!, sortOrder: 4, sets: 3, repTarget: 12, targetRpe: 9, restSec: 75 },
                  { exerciseId: E["overhead-triceps-extension"]!, sortOrder: 5, sets: 3, repTarget: 12, targetRpe: 9, restSec: 60 },
                ],
              },
            },
        ],
      },
    }),
  );

  // 5) Standard 6-day PPL × 2 (common “Push1 / Pull1 / Legs1 / Push2…” pattern).
  programs.push(
    await ensureSeededProgram({
      seedKey: "seed-ppl-6d-hyper",
      name: "PPL — 6-Day Hypertrophy",
      durationWeeks: 8,
      blocks: { create: blocks8.create },
      days: {
        create: [
            {
              sortOrder: 0,
              label: "Push 1 — chest bias",
              exercises: {
                create: [
                  { exerciseId: E["bench-press"]!, sortOrder: 0, sets: 4, repTarget: 6, targetRpe: 8, pctOf1rm: 78, restSec: 180 },
                  { exerciseId: E["incline-dumbbell-press"]!, sortOrder: 1, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                  { exerciseId: E["overhead-press"]!, sortOrder: 2, sets: 3, repTarget: 8, targetRpe: 8, restSec: 120 },
                  { exerciseId: E["lateral-raise"]!, sortOrder: 3, sets: 3, repTarget: 15, targetRpe: 9, restSec: 60 },
                  { exerciseId: E["triceps-pushdown"]!, sortOrder: 4, sets: 3, repTarget: 12, targetRpe: 9, restSec: 60 },
                  { exerciseId: E["skullcrusher"]!, sortOrder: 5, sets: 3, repTarget: 10, targetRpe: 9, restSec: 75 },
                ],
              },
            },
            {
              sortOrder: 1,
              label: "Pull 1 — width",
              exercises: {
                create: [
                  { exerciseId: E["pull-up"]!, sortOrder: 0, sets: 4, repTarget: 8, targetRpe: 8, restSec: 120 },
                  { exerciseId: E["lat-pulldown"]!, sortOrder: 1, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                  { exerciseId: E["chest-supported-row"]!, sortOrder: 2, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                  { exerciseId: E["face-pull"]!, sortOrder: 3, sets: 3, repTarget: 15, targetRpe: 9, restSec: 60 },
                  { exerciseId: E["barbell-curl"]!, sortOrder: 4, sets: 3, repTarget: 10, targetRpe: 9, restSec: 60 },
                ],
              },
            },
            {
              sortOrder: 2,
              label: "Legs 1 — quad bias",
              exercises: {
                create: [
                  { exerciseId: E["squat"]!, sortOrder: 0, sets: 4, repTarget: 6, targetRpe: 8, pctOf1rm: 78, restSec: 200 },
                  { exerciseId: E["leg-press"]!, sortOrder: 1, sets: 3, repTarget: 10, targetRpe: 8, restSec: 120 },
                  { exerciseId: E["leg-extension"]!, sortOrder: 2, sets: 3, repTarget: 12, targetRpe: 9, restSec: 60 },
                  { exerciseId: E["leg-curl"]!, sortOrder: 3, sets: 3, repTarget: 12, targetRpe: 9, restSec: 60 },
                  { exerciseId: E["calf-raise"]!, sortOrder: 4, sets: 4, repTarget: 12, targetRpe: 9, restSec: 60 },
                ],
              },
            },
            {
              sortOrder: 3,
              label: "Push 2 — shoulder bias",
              exercises: {
                create: [
                  { exerciseId: E["overhead-press"]!, sortOrder: 0, sets: 4, repTarget: 6, targetRpe: 8, pctOf1rm: 78, restSec: 180 },
                  { exerciseId: E["dumbbell-bench-press"]!, sortOrder: 1, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                  { exerciseId: E["cable-fly"]!, sortOrder: 2, sets: 3, repTarget: 12, targetRpe: 9, restSec: 60 },
                  { exerciseId: E["arnold-press"]!, sortOrder: 3, sets: 3, repTarget: 10, targetRpe: 9, restSec: 90 },
                  { exerciseId: E["cable-lateral-raise"]!, sortOrder: 4, sets: 3, repTarget: 15, targetRpe: 9, restSec: 60 },
                  { exerciseId: E["overhead-triceps-extension"]!, sortOrder: 5, sets: 3, repTarget: 12, targetRpe: 9, restSec: 60 },
                ],
              },
            },
            {
              sortOrder: 4,
              label: "Pull 2 — thickness",
              exercises: {
                create: [
                  { exerciseId: E["barbell-row"]!, sortOrder: 0, sets: 4, repTarget: 8, targetRpe: 8, restSec: 120 },
                  { exerciseId: E["t-bar-row"]!, sortOrder: 1, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                  { exerciseId: E["seated-cable-row"]!, sortOrder: 2, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                  { exerciseId: E["rear-delt-fly"]!, sortOrder: 3, sets: 3, repTarget: 15, targetRpe: 9, restSec: 60 },
                  { exerciseId: E["hammer-curl"]!, sortOrder: 4, sets: 3, repTarget: 12, targetRpe: 9, restSec: 60 },
                ],
              },
            },
            {
              sortOrder: 5,
              label: "Legs 2 — hinge & glute",
              exercises: {
                create: [
                  { exerciseId: E["deadlift"]!, sortOrder: 0, sets: 3, repTarget: 5, targetRpe: 8, pctOf1rm: 80, restSec: 240 },
                  { exerciseId: E["hack-squat"]!, sortOrder: 1, sets: 3, repTarget: 8, targetRpe: 8, restSec: 120 },
                  { exerciseId: E["romanian-deadlift"]!, sortOrder: 2, sets: 3, repTarget: 10, targetRpe: 8, restSec: 120 },
                  { exerciseId: E["hip-thrust"]!, sortOrder: 3, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                  { exerciseId: E["leg-curl"]!, sortOrder: 4, sets: 3, repTarget: 12, targetRpe: 9, restSec: 60 },
                  { exerciseId: E["calf-raise"]!, sortOrder: 5, sets: 4, repTarget: 12, targetRpe: 9, restSec: 60 },
                ],
              },
            },
        ],
      },
    }),
  );

  for (const data of homeGymProgramCreateData(E)) {
    programs.push(await ensureSeededProgram(data as Prisma.ProgramCreateInput & { seedKey: string }));
  }

  programs.push(
    await ensureSeededProgram(
      powerbuildingBlueprintProgramCreateData(E) as Prisma.ProgramCreateInput & { seedKey: string },
    ),
  );

  const hasActive = await prisma.programInstance.findFirst({
    where: { status: "ACTIVE", userId: seedUser.id },
  });
  if (!hasActive) {
    const defaultProgram =
      programs.find((p) => p.name === "Full Body — 3 templates") ?? programs[0];
    if (defaultProgram) {
      await prisma.programInstance.create({
        data: {
          userId: seedUser.id,
          programId: defaultProgram.id,
          status: "ACTIVE",
          weekIndex: 0,
          nextDaySortOrder: 0,
        },
      });
    }
  }

  console.log(`Seed OK: ${programs.length} programs — ${programs.map((p) => p.name).join(" | ")}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
