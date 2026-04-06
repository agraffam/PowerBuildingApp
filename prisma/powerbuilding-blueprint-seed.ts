import { PrescriptionLoadRole, type Prisma } from "@prisma/client";
import { trainingBlocksForWeeks } from "./home-gym-seed-programs";

export const POWERBUILDING_BLUEPRINT_PROGRAM_NAME = "The 60-Minute Powerbuilding Blueprint";

type E = Record<string, string>;

/**
 * Five-day commercial-gym style template (cables, machines, conditioning).
 * Rest between D3 and D4 is implicit (user skips training that day).
 */
export const POWERBUILDING_BLUEPRINT_SEED_KEY = "seed-powerbuilding-blueprint-60min";

export function powerbuildingBlueprintProgramCreateData(E: E): Prisma.ProgramCreateInput {
  return {
    seedKey: POWERBUILDING_BLUEPRINT_SEED_KEY,
    name: POWERBUILDING_BLUEPRINT_PROGRAM_NAME,
    durationWeeks: 12,
    blocks: trainingBlocksForWeeks(12, true),
    days: {
      create: [
        {
          sortOrder: 0,
          label: "D1 — Max Effort Lower (Squat)",
          exercises: {
            create: [
              {
                exerciseId: E["low-bar-squat"]!,
                sortOrder: 0,
                sets: 3,
                repTarget: 5,
                targetRpe: 8.5,
                restSec: 180,
                notes: "Set 1: 3 reps top @ RPE 8.5. Sets 2–3: 5 reps backoff @ ~75% of top.",
              },
              {
                exerciseId: E["goblet-squat"]!,
                sortOrder: 1,
                sets: 3,
                repTarget: 12,
                targetRpe: 8,
                restSec: 90,
                notes: "Focus on quad stretch.",
              },
              {
                exerciseId: E["leg-extension"]!,
                sortOrder: 2,
                sets: 3,
                repTarget: 15,
                targetRpe: 9,
                restSec: 60,
                notes: "Cable stack if available; continuous tension.",
              },
              {
                exerciseId: E["hanging-leg-raise"]!,
                sortOrder: 3,
                sets: 3,
                repTarget: 15,
                targetRpe: 9,
                restSec: 60,
                notes: "Max quality reps each set.",
              },
              {
                exerciseId: E["bike-erg"]!,
                sortOrder: 4,
                sets: 1,
                repTarget: 1,
                targetRpe: 6,
                restSec: 0,
                loadRole: PrescriptionLoadRole.CARDIO,
                targetDurationSec: 300,
                targetCalories: 70,
                notes:
                  "5 min steady-state flush. Prescription is time + optional kcal (adjust machine estimate).",
              },
            ],
          },
        },
        {
          sortOrder: 1,
          label: "D2 — Max Effort Upper (Bench + Arms A)",
          exercises: {
            create: [
              {
                exerciseId: E["bench-press"]!,
                sortOrder: 0,
                sets: 3,
                repTarget: 5,
                targetRpe: 8.5,
                restSec: 180,
                notes: "Set 1: 3 reps top @ RPE 8.5. Sets 2–3: 5 reps backoff @ ~75% of top.",
              },
              {
                exerciseId: E["chest-dip"]!,
                sortOrder: 1,
                sets: 3,
                repTarget: 9,
                targetRpe: 8,
                restSec: 90,
                notes: "3×8–10. Weighted when able; lean slightly forward for chest/tri crossover.",
              },
              {
                exerciseId: E["cable-fly"]!,
                sortOrder: 2,
                sets: 3,
                repTarget: 15,
                targetRpe: 9,
                restSec: 60,
                notes: "Functional trainer / cables.",
              },
              {
                exerciseId: E["skullcrusher"]!,
                sortOrder: 3,
                sets: 4,
                repTarget: 10,
                targetRpe: 8.5,
                restSec: 75,
                notes: "Big elbow flexion range.",
              },
              {
                exerciseId: E["alternating-dumbbell-curl"]!,
                sortOrder: 4,
                sets: 4,
                repTarget: 10,
                targetRpe: 8.5,
                restSec: 75,
                notes: "Supinate at the top.",
              },
            ],
          },
        },
        {
          sortOrder: 2,
          label: "D3 — Deadlift Build (Back)",
          exercises: {
            create: [
              {
                exerciseId: E["deadlift"]!,
                sortOrder: 0,
                sets: 4,
                repTarget: 3,
                targetRpe: 8.5,
                restSec: 180,
                notes: "Set 1: 2 reps top @ RPE 8.5. Sets 2–4: 3 reps @ ~80%.",
              },
              {
                exerciseId: E["lat-pulldown"]!,
                sortOrder: 1,
                sets: 3,
                repTarget: 11,
                targetRpe: 8,
                restSec: 90,
                notes: "3×10–12. Drive elbows to hips.",
              },
              {
                exerciseId: E["seated-cable-row"]!,
                sortOrder: 2,
                sets: 3,
                repTarget: 12,
                targetRpe: 8.5,
                restSec: 90,
                notes: "Low pulley; neutral grip if available.",
              },
              {
                exerciseId: E["face-pull"]!,
                sortOrder: 3,
                sets: 3,
                repTarget: 20,
                targetRpe: 9,
                restSec: 60,
                notes: "Pull to forehead.",
              },
              {
                exerciseId: E["hammer-curl"]!,
                sortOrder: 4,
                sets: 3,
                repTarget: 15,
                targetRpe: 9,
                restSec: 60,
                notes: "Cable rope; brachialis focus.",
              },
            ],
          },
        },
        {
          sortOrder: 3,
          label: "D4 — Upper Volume (Shoulders + Arms B)",
          exercises: {
            create: [
              {
                exerciseId: E["overhead-press"]!,
                sortOrder: 0,
                sets: 3,
                repTarget: 7,
                targetRpe: 8,
                restSec: 120,
                notes: "3×6–8 @ RPE 8.",
              },
              {
                exerciseId: E["incline-dumbbell-press"]!,
                sortOrder: 1,
                sets: 3,
                repTarget: 11,
                targetRpe: 8,
                restSec: 90,
                notes: "3×10–12; upper chest bias.",
              },
              {
                exerciseId: E["triceps-pushdown"]!,
                sortOrder: 2,
                sets: 4,
                repTarget: 15,
                targetRpe: 9,
                restSec: 60,
                notes: "Rope attachment; flare at bottom.",
              },
              {
                exerciseId: E["cable-straight-bar-curl"]!,
                sortOrder: 3,
                sets: 4,
                repTarget: 12,
                targetRpe: 9,
                restSec: 60,
                notes: "Constant tension.",
              },
              {
                exerciseId: E["lateral-raise"]!,
                sortOrder: 4,
                sets: 4,
                repTarget: 17,
                targetRpe: 9,
                restSec: 45,
                notes: "4×15–20; dumbbells. Maintain pump.",
              },
            ],
          },
        },
        {
          sortOrder: 4,
          label: "D5 — Posterior & GPP",
          exercises: {
            create: [
              {
                exerciseId: E["romanian-deadlift"]!,
                sortOrder: 0,
                sets: 4,
                repTarget: 9,
                targetRpe: 7.5,
                restSec: 120,
                notes: "4×8–10 @ RPE 7.5.",
              },
              {
                exerciseId: E["neutral-grip-pull-up"]!,
                sortOrder: 1,
                sets: 3,
                repTarget: 8,
                targetRpe: 8.5,
                restSec: 90,
                notes: "Max reps each set; add load or band as needed.",
              },
              {
                exerciseId: E["dumbbell-shrug"]!,
                sortOrder: 2,
                sets: 3,
                repTarget: 15,
                targetRpe: 8.5,
                restSec: 60,
                notes: "Heavy hold at top.",
              },
              {
                exerciseId: E["assault-runner-intervals"]!,
                sortOrder: 3,
                sets: 8,
                repTarget: 1,
                targetRpe: 8,
                restSec: 0,
                loadRole: PrescriptionLoadRole.CARDIO,
                targetDurationSec: 60,
                targetCalories: 25,
                notes:
                  "8 rounds: 20s sprint / 40s walk (~60s per bout). Log duration + optional kcal per bout.",
              },
            ],
          },
        },
      ],
    },
  };
}
