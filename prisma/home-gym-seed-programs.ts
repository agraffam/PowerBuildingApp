/**
 * Fifteen home-gym-oriented templates (rack + barbell, dumbbells, bench, pull-up bar).
 * Avoids cable stacks and most machines; uses existing exercise catalog slugs.
 */
import { BlockType, type Prisma } from "@prisma/client";

export const SEED_TEMPLATE_PROGRAM_NAMES = [
  "5×5 A/B",
  "Full Body 3-Day",
  "Upper / Lower 4-Day",
  "PPL 3-Day",
  "Push / Pull 4-Day",
  "Express 3-Day",
  "Full Body 4 Templates",
  "Glutes & Hamstrings",
  "Pressing Focus",
  "Squat & Deadlift 16wk",
  "Bro Split (5-Day)",
  "Powerbuilding 3-Day",
  "Athletic Full Body",
  "Beginner 15wk",
  "Upper / Lower Strength",
] as const;

export function trainingBlocksForWeeks(durationWeeks: number) {
  const mid = Math.floor(durationWeeks / 2);
  return {
    create: [
      { blockType: BlockType.HYPERTROPHY, sortOrder: 0, startWeek: 1, endWeek: mid },
      { blockType: BlockType.STRENGTH, sortOrder: 1, startWeek: mid + 1, endWeek: durationWeeks },
    ],
  };
}

type E = Record<string, string>;

export function homeGymProgramCreateData(E: E): Prisma.ProgramCreateInput[] {
  return [
    {
      name: SEED_TEMPLATE_PROGRAM_NAMES[0],
      durationWeeks: 12,
      blocks: trainingBlocksForWeeks(12),
      days: {
        create: [
          {
            sortOrder: 0,
            label: "A — Squat / Bench / Row",
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
            label: "B — Squat / OHP / Deadlift",
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
    },
    {
      name: SEED_TEMPLATE_PROGRAM_NAMES[1],
      durationWeeks: 10,
      blocks: trainingBlocksForWeeks(10),
      days: {
        create: [
          {
            sortOrder: 0,
            label: "Full Body — Squat & push",
            exercises: {
              create: [
                { exerciseId: E["squat"]!, sortOrder: 0, sets: 4, repTarget: 6, targetRpe: 8, pctOf1rm: 78, restSec: 200 },
                { exerciseId: E["dumbbell-bench-press"]!, sortOrder: 1, sets: 3, repTarget: 10, targetRpe: 8, restSec: 120 },
                { exerciseId: E["pendlay-row"]!, sortOrder: 2, sets: 3, repTarget: 8, targetRpe: 8, restSec: 120 },
                { exerciseId: E["walking-lunge"]!, sortOrder: 3, sets: 2, repTarget: 10, targetRpe: 8, restSec: 90 },
                { exerciseId: E["lateral-raise"]!, sortOrder: 4, sets: 3, repTarget: 12, targetRpe: 9, restSec: 60 },
              ],
            },
          },
          {
            sortOrder: 1,
            label: "Full Body — Hinge & pull",
            exercises: {
              create: [
                { exerciseId: E["romanian-deadlift"]!, sortOrder: 0, sets: 3, repTarget: 8, targetRpe: 8, restSec: 150 },
                { exerciseId: E["overhead-press"]!, sortOrder: 1, sets: 3, repTarget: 8, targetRpe: 8, restSec: 150 },
                { exerciseId: E["pull-up"]!, sortOrder: 2, sets: 3, repTarget: 8, targetRpe: 8, restSec: 120 },
                { exerciseId: E["bulgarian-split-squat"]!, sortOrder: 3, sets: 2, repTarget: 10, targetRpe: 8, restSec: 90 },
                { exerciseId: E["hammer-curl"]!, sortOrder: 4, sets: 2, repTarget: 12, targetRpe: 9, restSec: 60 },
              ],
            },
          },
          {
            sortOrder: 2,
            label: "Full Body — Mix",
            exercises: {
              create: [
                { exerciseId: E["front-squat"]!, sortOrder: 0, sets: 3, repTarget: 6, targetRpe: 8, restSec: 180 },
                { exerciseId: E["incline-dumbbell-press"]!, sortOrder: 1, sets: 3, repTarget: 10, targetRpe: 8, restSec: 120 },
                { exerciseId: E["chest-supported-row"]!, sortOrder: 2, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                { exerciseId: E["hip-thrust"]!, sortOrder: 3, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                { exerciseId: E["skullcrusher"]!, sortOrder: 4, sets: 2, repTarget: 12, targetRpe: 9, restSec: 75 },
                { exerciseId: E["calf-raise"]!, sortOrder: 5, sets: 3, repTarget: 15, targetRpe: 9, restSec: 45 },
              ],
            },
          },
        ],
      },
    },
    {
      name: SEED_TEMPLATE_PROGRAM_NAMES[2],
      durationWeeks: 8,
      blocks: trainingBlocksForWeeks(8),
      days: {
        create: [
          {
            sortOrder: 0,
            label: "Upper — Heavy compounds",
            exercises: {
              create: [
                { exerciseId: E["bench-press"]!, sortOrder: 0, sets: 4, repTarget: 5, targetRpe: 8, pctOf1rm: 82, restSec: 200 },
                { exerciseId: E["pendlay-row"]!, sortOrder: 1, sets: 4, repTarget: 5, targetRpe: 8, pctOf1rm: 78, restSec: 180 },
                { exerciseId: E["overhead-press"]!, sortOrder: 2, sets: 3, repTarget: 6, targetRpe: 8, restSec: 150 },
                { exerciseId: E["pull-up"]!, sortOrder: 3, sets: 3, repTarget: 8, targetRpe: 8, restSec: 120 },
                { exerciseId: E["rear-delt-fly"]!, sortOrder: 4, sets: 3, repTarget: 15, targetRpe: 9, restSec: 60 },
              ],
            },
          },
          {
            sortOrder: 1,
            label: "Lower — Squat bias",
            exercises: {
              create: [
                { exerciseId: E["squat"]!, sortOrder: 0, sets: 4, repTarget: 5, targetRpe: 8, pctOf1rm: 82, restSec: 220 },
                { exerciseId: E["romanian-deadlift"]!, sortOrder: 1, sets: 3, repTarget: 8, targetRpe: 8, restSec: 150 },
                { exerciseId: E["step-up"]!, sortOrder: 2, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                { exerciseId: E["nordic-hamstring-curl"]!, sortOrder: 3, sets: 2, repTarget: 6, targetRpe: 8, restSec: 90 },
                { exerciseId: E["calf-raise"]!, sortOrder: 4, sets: 4, repTarget: 12, targetRpe: 9, restSec: 60 },
              ],
            },
          },
          {
            sortOrder: 2,
            label: "Upper — Volume",
            exercises: {
              create: [
                { exerciseId: E["incline-barbell-bench"]!, sortOrder: 0, sets: 4, repTarget: 8, targetRpe: 8, restSec: 120 },
                { exerciseId: E["t-bar-row"]!, sortOrder: 1, sets: 4, repTarget: 10, targetRpe: 8, restSec: 90 },
                { exerciseId: E["arnold-press"]!, sortOrder: 2, sets: 3, repTarget: 10, targetRpe: 9, restSec: 90 },
                { exerciseId: E["chin-up"]!, sortOrder: 3, sets: 3, repTarget: 8, targetRpe: 8, restSec: 120 },
                { exerciseId: E["lateral-raise"]!, sortOrder: 4, sets: 3, repTarget: 15, targetRpe: 9, restSec: 60 },
                { exerciseId: E["overhead-triceps-extension"]!, sortOrder: 5, sets: 3, repTarget: 12, targetRpe: 9, restSec: 60 },
              ],
            },
          },
          {
            sortOrder: 3,
            label: "Lower — Hinge bias",
            exercises: {
              create: [
                { exerciseId: E["deadlift"]!, sortOrder: 0, sets: 3, repTarget: 4, targetRpe: 8.5, pctOf1rm: 84, restSec: 240 },
                { exerciseId: E["goblet-squat"]!, sortOrder: 1, sets: 3, repTarget: 12, targetRpe: 8, restSec: 90 },
                { exerciseId: E["bulgarian-split-squat"]!, sortOrder: 2, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                { exerciseId: E["hip-thrust"]!, sortOrder: 3, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                { exerciseId: E["walking-lunge"]!, sortOrder: 4, sets: 2, repTarget: 12, targetRpe: 8, restSec: 90 },
              ],
            },
          },
        ],
      },
    },
    {
      name: SEED_TEMPLATE_PROGRAM_NAMES[3],
      durationWeeks: 9,
      blocks: trainingBlocksForWeeks(9),
      days: {
        create: [
          {
            sortOrder: 0,
            label: "Push",
            exercises: {
              create: [
                { exerciseId: E["bench-press"]!, sortOrder: 0, sets: 4, repTarget: 6, targetRpe: 8, pctOf1rm: 78, restSec: 180 },
                { exerciseId: E["incline-dumbbell-press"]!, sortOrder: 1, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                { exerciseId: E["overhead-press"]!, sortOrder: 2, sets: 3, repTarget: 8, targetRpe: 8, restSec: 120 },
                { exerciseId: E["lateral-raise"]!, sortOrder: 3, sets: 3, repTarget: 15, targetRpe: 9, restSec: 60 },
                { exerciseId: E["skullcrusher"]!, sortOrder: 4, sets: 3, repTarget: 10, targetRpe: 9, restSec: 75 },
              ],
            },
          },
          {
            sortOrder: 1,
            label: "Pull",
            exercises: {
              create: [
                { exerciseId: E["pull-up"]!, sortOrder: 0, sets: 4, repTarget: 8, targetRpe: 8, restSec: 120 },
                { exerciseId: E["barbell-row"]!, sortOrder: 1, sets: 4, repTarget: 8, targetRpe: 8, restSec: 120 },
                { exerciseId: E["chest-supported-row"]!, sortOrder: 2, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                { exerciseId: E["rear-delt-fly"]!, sortOrder: 3, sets: 3, repTarget: 15, targetRpe: 9, restSec: 60 },
                { exerciseId: E["barbell-curl"]!, sortOrder: 4, sets: 3, repTarget: 10, targetRpe: 9, restSec: 60 },
              ],
            },
          },
          {
            sortOrder: 2,
            label: "Legs",
            exercises: {
              create: [
                { exerciseId: E["squat"]!, sortOrder: 0, sets: 4, repTarget: 6, targetRpe: 8, pctOf1rm: 78, restSec: 200 },
                { exerciseId: E["romanian-deadlift"]!, sortOrder: 1, sets: 3, repTarget: 8, targetRpe: 8, restSec: 150 },
                { exerciseId: E["walking-lunge"]!, sortOrder: 2, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                { exerciseId: E["hip-thrust"]!, sortOrder: 3, sets: 3, repTarget: 12, targetRpe: 8, restSec: 90 },
                { exerciseId: E["calf-raise"]!, sortOrder: 4, sets: 4, repTarget: 12, targetRpe: 9, restSec: 60 },
              ],
            },
          },
        ],
      },
    },
    {
      name: SEED_TEMPLATE_PROGRAM_NAMES[4],
      durationWeeks: 7,
      blocks: trainingBlocksForWeeks(7),
      days: {
        create: [
          {
            sortOrder: 0,
            label: "Push A",
            exercises: {
              create: [
                { exerciseId: E["bench-press"]!, sortOrder: 0, sets: 4, repTarget: 5, targetRpe: 8, pctOf1rm: 80, restSec: 180 },
                { exerciseId: E["dumbbell-bench-press"]!, sortOrder: 1, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                { exerciseId: E["landmine-press"]!, sortOrder: 2, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                { exerciseId: E["lateral-raise"]!, sortOrder: 3, sets: 4, repTarget: 12, targetRpe: 9, restSec: 60 },
                { exerciseId: E["close-grip-bench"]!, sortOrder: 4, sets: 3, repTarget: 8, targetRpe: 8, restSec: 120 },
              ],
            },
          },
          {
            sortOrder: 1,
            label: "Pull A",
            exercises: {
              create: [
                { exerciseId: E["deadlift"]!, sortOrder: 0, sets: 3, repTarget: 5, targetRpe: 8, pctOf1rm: 80, restSec: 240 },
                { exerciseId: E["pull-up"]!, sortOrder: 1, sets: 4, repTarget: 8, targetRpe: 8, restSec: 120 },
                { exerciseId: E["t-bar-row"]!, sortOrder: 2, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                { exerciseId: E["face-pull"]!, sortOrder: 3, sets: 3, repTarget: 15, targetRpe: 9, restSec: 60 },
                { exerciseId: E["hammer-curl"]!, sortOrder: 4, sets: 3, repTarget: 12, targetRpe: 9, restSec: 60 },
              ],
            },
          },
          {
            sortOrder: 2,
            label: "Push B",
            exercises: {
              create: [
                { exerciseId: E["overhead-press"]!, sortOrder: 0, sets: 4, repTarget: 6, targetRpe: 8, pctOf1rm: 78, restSec: 180 },
                { exerciseId: E["incline-barbell-bench"]!, sortOrder: 1, sets: 3, repTarget: 8, targetRpe: 8, restSec: 120 },
                { exerciseId: E["arnold-press"]!, sortOrder: 2, sets: 3, repTarget: 10, targetRpe: 9, restSec: 90 },
                { exerciseId: E["rear-delt-fly"]!, sortOrder: 3, sets: 3, repTarget: 15, targetRpe: 9, restSec: 60 },
                { exerciseId: E["overhead-triceps-extension"]!, sortOrder: 4, sets: 3, repTarget: 12, targetRpe: 9, restSec: 60 },
              ],
            },
          },
          {
            sortOrder: 3,
            label: "Pull B",
            exercises: {
              create: [
                { exerciseId: E["sumo-deadlift"]!, sortOrder: 0, sets: 3, repTarget: 5, targetRpe: 8, restSec: 200 },
                { exerciseId: E["chin-up"]!, sortOrder: 1, sets: 4, repTarget: 8, targetRpe: 8, restSec: 120 },
                { exerciseId: E["pendlay-row"]!, sortOrder: 2, sets: 4, repTarget: 6, targetRpe: 8, restSec: 120 },
                { exerciseId: E["chest-supported-row"]!, sortOrder: 3, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                { exerciseId: E["preacher-curl"]!, sortOrder: 4, sets: 3, repTarget: 12, targetRpe: 9, restSec: 60 },
              ],
            },
          },
        ],
      },
    },
    {
      name: SEED_TEMPLATE_PROGRAM_NAMES[5],
      durationWeeks: 6,
      blocks: trainingBlocksForWeeks(6),
      days: {
        create: [
          {
            sortOrder: 0,
            label: "Express A",
            exercises: {
              create: [
                { exerciseId: E["squat"]!, sortOrder: 0, sets: 3, repTarget: 8, targetRpe: 8, pctOf1rm: 74, restSec: 150 },
                { exerciseId: E["bench-press"]!, sortOrder: 1, sets: 3, repTarget: 8, targetRpe: 8, pctOf1rm: 74, restSec: 120 },
                { exerciseId: E["barbell-row"]!, sortOrder: 2, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
              ],
            },
          },
          {
            sortOrder: 1,
            label: "Express B",
            exercises: {
              create: [
                { exerciseId: E["deadlift"]!, sortOrder: 0, sets: 2, repTarget: 5, targetRpe: 8, pctOf1rm: 78, restSec: 200 },
                { exerciseId: E["overhead-press"]!, sortOrder: 1, sets: 3, repTarget: 8, targetRpe: 8, restSec: 120 },
                { exerciseId: E["pull-up"]!, sortOrder: 2, sets: 3, repTarget: 8, targetRpe: 8, restSec: 90 },
              ],
            },
          },
          {
            sortOrder: 2,
            label: "Express C",
            exercises: {
              create: [
                { exerciseId: E["goblet-squat"]!, sortOrder: 0, sets: 3, repTarget: 12, targetRpe: 8, restSec: 90 },
                { exerciseId: E["dumbbell-bench-press"]!, sortOrder: 1, sets: 3, repTarget: 12, targetRpe: 8, restSec: 90 },
                { exerciseId: E["romanian-deadlift"]!, sortOrder: 2, sets: 3, repTarget: 10, targetRpe: 8, restSec: 120 },
              ],
            },
          },
        ],
      },
    },
    {
      name: SEED_TEMPLATE_PROGRAM_NAMES[6],
      durationWeeks: 14,
      blocks: trainingBlocksForWeeks(14),
      days: {
        create: [
          {
            sortOrder: 0,
            label: "FB — Squat heavy",
            exercises: {
              create: [
                { exerciseId: E["pause-squat"]!, sortOrder: 0, sets: 4, repTarget: 4, targetRpe: 8, restSec: 200 },
                { exerciseId: E["incline-dumbbell-press"]!, sortOrder: 1, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                { exerciseId: E["pull-up"]!, sortOrder: 2, sets: 3, repTarget: 8, targetRpe: 8, restSec: 120 },
                { exerciseId: E["bulgarian-split-squat"]!, sortOrder: 3, sets: 2, repTarget: 10, targetRpe: 8, restSec: 90 },
              ],
            },
          },
          {
            sortOrder: 1,
            label: "FB — Bench heavy",
            exercises: {
              create: [
                { exerciseId: E["bench-press"]!, sortOrder: 0, sets: 4, repTarget: 5, targetRpe: 8, pctOf1rm: 80, restSec: 180 },
                { exerciseId: E["front-squat"]!, sortOrder: 1, sets: 3, repTarget: 6, targetRpe: 8, restSec: 150 },
                { exerciseId: E["pendlay-row"]!, sortOrder: 2, sets: 3, repTarget: 8, targetRpe: 8, restSec: 120 },
                { exerciseId: E["hip-thrust"]!, sortOrder: 3, sets: 3, repTarget: 12, targetRpe: 8, restSec: 90 },
              ],
            },
          },
          {
            sortOrder: 2,
            label: "FB — Hinge heavy",
            exercises: {
              create: [
                { exerciseId: E["deadlift"]!, sortOrder: 0, sets: 3, repTarget: 4, targetRpe: 8.5, pctOf1rm: 82, restSec: 240 },
                { exerciseId: E["dumbbell-bench-press"]!, sortOrder: 1, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                { exerciseId: E["chin-up"]!, sortOrder: 2, sets: 3, repTarget: 8, targetRpe: 8, restSec: 120 },
                { exerciseId: E["walking-lunge"]!, sortOrder: 3, sets: 2, repTarget: 12, targetRpe: 8, restSec: 90 },
              ],
            },
          },
          {
            sortOrder: 3,
            label: "FB — Accessories & core",
            exercises: {
              create: [
                { exerciseId: E["squat"]!, sortOrder: 0, sets: 3, repTarget: 10, targetRpe: 8, pctOf1rm: 70, restSec: 120 },
                { exerciseId: E["overhead-press"]!, sortOrder: 1, sets: 3, repTarget: 8, targetRpe: 8, restSec: 120 },
                { exerciseId: E["chest-supported-row"]!, sortOrder: 2, sets: 3, repTarget: 12, targetRpe: 8, restSec: 90 },
                { exerciseId: E["hanging-knee-raise"]!, sortOrder: 3, sets: 3, repTarget: 12, targetRpe: 8, restSec: 60 },
                { exerciseId: E["calf-raise"]!, sortOrder: 4, sets: 3, repTarget: 15, targetRpe: 9, restSec: 45 },
              ],
            },
          },
        ],
      },
    },
    {
      name: SEED_TEMPLATE_PROGRAM_NAMES[7],
      durationWeeks: 11,
      blocks: trainingBlocksForWeeks(11),
      days: {
        create: [
          {
            sortOrder: 0,
            label: "Posterior + glutes A",
            exercises: {
              create: [
                { exerciseId: E["romanian-deadlift"]!, sortOrder: 0, sets: 4, repTarget: 8, targetRpe: 8, restSec: 150 },
                { exerciseId: E["hip-thrust"]!, sortOrder: 1, sets: 4, repTarget: 10, targetRpe: 8, restSec: 120 },
                { exerciseId: E["nordic-hamstring-curl"]!, sortOrder: 2, sets: 3, repTarget: 6, targetRpe: 8, restSec: 90 },
                { exerciseId: E["glute-bridge"]!, sortOrder: 3, sets: 3, repTarget: 15, targetRpe: 9, restSec: 60 },
              ],
            },
          },
          {
            sortOrder: 1,
            label: "Quad balance",
            exercises: {
              create: [
                { exerciseId: E["front-squat"]!, sortOrder: 0, sets: 4, repTarget: 6, targetRpe: 8, restSec: 180 },
                { exerciseId: E["bulgarian-split-squat"]!, sortOrder: 1, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                { exerciseId: E["step-up"]!, sortOrder: 2, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                { exerciseId: E["calf-raise"]!, sortOrder: 3, sets: 4, repTarget: 12, targetRpe: 9, restSec: 60 },
              ],
            },
          },
          {
            sortOrder: 2,
            label: "Posterior + glutes B",
            exercises: {
              create: [
                { exerciseId: E["sumo-deadlift"]!, sortOrder: 0, sets: 3, repTarget: 5, targetRpe: 8, restSec: 200 },
                { exerciseId: E["deficit-deadlift"]!, sortOrder: 1, sets: 2, repTarget: 4, targetRpe: 8, restSec: 200 },
                { exerciseId: E["walking-lunge"]!, sortOrder: 2, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                { exerciseId: E["hip-thrust"]!, sortOrder: 3, sets: 3, repTarget: 12, targetRpe: 8, restSec: 90 },
              ],
            },
          },
          {
            sortOrder: 3,
            label: "Full lower mix",
            exercises: {
              create: [
                { exerciseId: E["squat"]!, sortOrder: 0, sets: 3, repTarget: 8, targetRpe: 8, pctOf1rm: 74, restSec: 180 },
                { exerciseId: E["deadlift"]!, sortOrder: 1, sets: 2, repTarget: 5, targetRpe: 8, pctOf1rm: 78, restSec: 220 },
                { exerciseId: E["goblet-squat"]!, sortOrder: 2, sets: 3, repTarget: 12, targetRpe: 8, restSec: 75 },
                { exerciseId: E["ab-wheel-rollout"]!, sortOrder: 3, sets: 3, repTarget: 10, targetRpe: 8, restSec: 60 },
              ],
            },
          },
        ],
      },
    },
    {
      name: SEED_TEMPLATE_PROGRAM_NAMES[8],
      durationWeeks: 10,
      blocks: trainingBlocksForWeeks(10),
      days: {
        create: [
          {
            sortOrder: 0,
            label: "Bench emphasis",
            exercises: {
              create: [
                { exerciseId: E["bench-press"]!, sortOrder: 0, sets: 5, repTarget: 5, targetRpe: 8, pctOf1rm: 80, restSec: 200 },
                { exerciseId: E["pin-press"]!, sortOrder: 1, sets: 3, repTarget: 5, targetRpe: 8, restSec: 150 },
                { exerciseId: E["dumbbell-bench-press"]!, sortOrder: 2, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                { exerciseId: E["skullcrusher"]!, sortOrder: 3, sets: 3, repTarget: 10, targetRpe: 9, restSec: 75 },
              ],
            },
          },
          {
            sortOrder: 1,
            label: "Overhead + incline",
            exercises: {
              create: [
                { exerciseId: E["overhead-press"]!, sortOrder: 0, sets: 4, repTarget: 6, targetRpe: 8, pctOf1rm: 78, restSec: 180 },
                { exerciseId: E["incline-barbell-bench"]!, sortOrder: 1, sets: 4, repTarget: 8, targetRpe: 8, restSec: 120 },
                { exerciseId: E["landmine-press"]!, sortOrder: 2, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                { exerciseId: E["lateral-raise"]!, sortOrder: 3, sets: 4, repTarget: 12, targetRpe: 9, restSec: 60 },
              ],
            },
          },
          {
            sortOrder: 2,
            label: "Pull maintenance",
            exercises: {
              create: [
                { exerciseId: E["pull-up"]!, sortOrder: 0, sets: 4, repTarget: 8, targetRpe: 8, restSec: 120 },
                { exerciseId: E["pendlay-row"]!, sortOrder: 1, sets: 4, repTarget: 6, targetRpe: 8, restSec: 120 },
                { exerciseId: E["face-pull"]!, sortOrder: 2, sets: 3, repTarget: 15, targetRpe: 9, restSec: 60 },
              ],
            },
          },
          {
            sortOrder: 3,
            label: "Arms + close-grip",
            exercises: {
              create: [
                { exerciseId: E["close-grip-bench"]!, sortOrder: 0, sets: 4, repTarget: 6, targetRpe: 8, restSec: 150 },
                { exerciseId: E["overhead-triceps-extension"]!, sortOrder: 1, sets: 3, repTarget: 12, targetRpe: 9, restSec: 60 },
                { exerciseId: E["barbell-curl"]!, sortOrder: 2, sets: 4, repTarget: 10, targetRpe: 9, restSec: 60 },
                { exerciseId: E["hammer-curl"]!, sortOrder: 3, sets: 3, repTarget: 12, targetRpe: 9, restSec: 60 },
              ],
            },
          },
        ],
      },
    },
    {
      name: SEED_TEMPLATE_PROGRAM_NAMES[9],
      durationWeeks: 16,
      blocks: trainingBlocksForWeeks(16),
      days: {
        create: [
          {
            sortOrder: 0,
            label: "Squat strength",
            exercises: {
              create: [
                { exerciseId: E["squat"]!, sortOrder: 0, sets: 5, repTarget: 3, targetRpe: 8.5, pctOf1rm: 86, restSec: 240 },
                { exerciseId: E["pause-squat"]!, sortOrder: 1, sets: 3, repTarget: 4, targetRpe: 8, restSec: 200 },
                { exerciseId: E["bulgarian-split-squat"]!, sortOrder: 2, sets: 3, repTarget: 8, targetRpe: 8, restSec: 90 },
                { exerciseId: E["calf-raise"]!, sortOrder: 3, sets: 3, repTarget: 12, targetRpe: 9, restSec: 60 },
              ],
            },
          },
          {
            sortOrder: 1,
            label: "Deadlift strength",
            exercises: {
              create: [
                { exerciseId: E["deadlift"]!, sortOrder: 0, sets: 4, repTarget: 3, targetRpe: 8.5, pctOf1rm: 86, restSec: 260 },
                { exerciseId: E["rack-pull"]!, sortOrder: 1, sets: 3, repTarget: 5, targetRpe: 8, restSec: 200 },
                { exerciseId: E["romanian-deadlift"]!, sortOrder: 2, sets: 3, repTarget: 8, targetRpe: 8, restSec: 150 },
              ],
            },
          },
          {
            sortOrder: 2,
            label: "Squat volume",
            exercises: {
              create: [
                { exerciseId: E["front-squat"]!, sortOrder: 0, sets: 4, repTarget: 6, targetRpe: 8, restSec: 180 },
                { exerciseId: E["goblet-squat"]!, sortOrder: 1, sets: 3, repTarget: 12, targetRpe: 8, restSec: 90 },
                { exerciseId: E["walking-lunge"]!, sortOrder: 2, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                { exerciseId: E["hip-thrust"]!, sortOrder: 3, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
              ],
            },
          },
          {
            sortOrder: 3,
            label: "Hinge volume",
            exercises: {
              create: [
                { exerciseId: E["sumo-deadlift"]!, sortOrder: 0, sets: 3, repTarget: 5, targetRpe: 8, restSec: 220 },
                { exerciseId: E["deficit-deadlift"]!, sortOrder: 1, sets: 2, repTarget: 4, targetRpe: 8, restSec: 200 },
                { exerciseId: E["nordic-hamstring-curl"]!, sortOrder: 2, sets: 3, repTarget: 6, targetRpe: 8, restSec: 90 },
                { exerciseId: E["step-up"]!, sortOrder: 3, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
              ],
            },
          },
        ],
      },
    },
    {
      name: SEED_TEMPLATE_PROGRAM_NAMES[10],
      durationWeeks: 13,
      blocks: trainingBlocksForWeeks(13),
      days: {
        create: [
          {
            sortOrder: 0,
            label: "Chest & triceps",
            exercises: {
              create: [
                { exerciseId: E["incline-barbell-bench"]!, sortOrder: 0, sets: 4, repTarget: 8, targetRpe: 8, restSec: 120 },
                { exerciseId: E["bench-press"]!, sortOrder: 1, sets: 3, repTarget: 8, targetRpe: 8, restSec: 120 },
                { exerciseId: E["dumbbell-bench-press"]!, sortOrder: 2, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                { exerciseId: E["skullcrusher"]!, sortOrder: 3, sets: 3, repTarget: 10, targetRpe: 9, restSec: 75 },
                { exerciseId: E["close-grip-bench"]!, sortOrder: 4, sets: 3, repTarget: 8, targetRpe: 8, restSec: 120 },
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
                { exerciseId: E["t-bar-row"]!, sortOrder: 2, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                { exerciseId: E["rear-delt-fly"]!, sortOrder: 3, sets: 3, repTarget: 15, targetRpe: 9, restSec: 60 },
                { exerciseId: E["barbell-curl"]!, sortOrder: 4, sets: 3, repTarget: 10, targetRpe: 9, restSec: 60 },
                { exerciseId: E["hammer-curl"]!, sortOrder: 5, sets: 3, repTarget: 12, targetRpe: 9, restSec: 60 },
              ],
            },
          },
          {
            sortOrder: 2,
            label: "Legs",
            exercises: {
              create: [
                { exerciseId: E["squat"]!, sortOrder: 0, sets: 4, repTarget: 8, targetRpe: 8, pctOf1rm: 76, restSec: 200 },
                { exerciseId: E["romanian-deadlift"]!, sortOrder: 1, sets: 3, repTarget: 10, targetRpe: 8, restSec: 120 },
                { exerciseId: E["bulgarian-split-squat"]!, sortOrder: 2, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                { exerciseId: E["nordic-hamstring-curl"]!, sortOrder: 3, sets: 3, repTarget: 6, targetRpe: 8, restSec: 90 },
                { exerciseId: E["calf-raise"]!, sortOrder: 4, sets: 4, repTarget: 15, targetRpe: 9, restSec: 45 },
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
                { exerciseId: E["face-pull"]!, sortOrder: 3, sets: 3, repTarget: 15, targetRpe: 9, restSec: 60 },
                { exerciseId: E["barbell-shrugs"]!, sortOrder: 4, sets: 3, repTarget: 12, targetRpe: 9, restSec: 75 },
              ],
            },
          },
          {
            sortOrder: 4,
            label: "Arms",
            exercises: {
              create: [
                { exerciseId: E["barbell-curl"]!, sortOrder: 0, sets: 4, repTarget: 10, targetRpe: 9, restSec: 60 },
                { exerciseId: E["preacher-curl"]!, sortOrder: 1, sets: 3, repTarget: 12, targetRpe: 9, restSec: 60 },
                { exerciseId: E["concentration-curl"]!, sortOrder: 2, sets: 2, repTarget: 12, targetRpe: 9, restSec: 60 },
                { exerciseId: E["close-grip-bench"]!, sortOrder: 3, sets: 3, repTarget: 8, targetRpe: 8, restSec: 120 },
                { exerciseId: E["overhead-triceps-extension"]!, sortOrder: 4, sets: 3, repTarget: 12, targetRpe: 9, restSec: 60 },
              ],
            },
          },
        ],
      },
    },
    {
      name: SEED_TEMPLATE_PROGRAM_NAMES[11],
      durationWeeks: 12,
      blocks: trainingBlocksForWeeks(12),
      days: {
        create: [
          {
            sortOrder: 0,
            label: "Heavy full body",
            exercises: {
              create: [
                { exerciseId: E["squat"]!, sortOrder: 0, sets: 4, repTarget: 4, targetRpe: 8.5, pctOf1rm: 84, restSec: 220 },
                { exerciseId: E["bench-press"]!, sortOrder: 1, sets: 4, repTarget: 4, targetRpe: 8.5, pctOf1rm: 82, restSec: 200 },
                { exerciseId: E["pendlay-row"]!, sortOrder: 2, sets: 4, repTarget: 5, targetRpe: 8, restSec: 150 },
              ],
            },
          },
          {
            sortOrder: 1,
            label: "Volume full body",
            exercises: {
              create: [
                { exerciseId: E["deadlift"]!, sortOrder: 0, sets: 2, repTarget: 5, targetRpe: 8, pctOf1rm: 78, restSec: 240 },
                { exerciseId: E["overhead-press"]!, sortOrder: 1, sets: 3, repTarget: 8, targetRpe: 8, restSec: 150 },
                { exerciseId: E["pull-up"]!, sortOrder: 2, sets: 3, repTarget: 8, targetRpe: 8, restSec: 120 },
                { exerciseId: E["bulgarian-split-squat"]!, sortOrder: 3, sets: 2, repTarget: 10, targetRpe: 8, restSec: 90 },
                { exerciseId: E["incline-dumbbell-press"]!, sortOrder: 4, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
              ],
            },
          },
          {
            sortOrder: 2,
            label: "Pump full body",
            exercises: {
              create: [
                { exerciseId: E["front-squat"]!, sortOrder: 0, sets: 3, repTarget: 8, targetRpe: 8, restSec: 150 },
                { exerciseId: E["dumbbell-bench-press"]!, sortOrder: 1, sets: 3, repTarget: 12, targetRpe: 8, restSec: 90 },
                { exerciseId: E["t-bar-row"]!, sortOrder: 2, sets: 3, repTarget: 12, targetRpe: 8, restSec: 90 },
                { exerciseId: E["romanian-deadlift"]!, sortOrder: 3, sets: 3, repTarget: 10, targetRpe: 8, restSec: 120 },
                { exerciseId: E["lateral-raise"]!, sortOrder: 4, sets: 3, repTarget: 15, targetRpe: 9, restSec: 60 },
                { exerciseId: E["skullcrusher"]!, sortOrder: 5, sets: 2, repTarget: 12, targetRpe: 9, restSec: 75 },
              ],
            },
          },
        ],
      },
    },
    {
      name: SEED_TEMPLATE_PROGRAM_NAMES[12],
      durationWeeks: 8,
      blocks: trainingBlocksForWeeks(8),
      days: {
        create: [
          {
            sortOrder: 0,
            label: "Athletic A — legs & core",
            exercises: {
              create: [
                { exerciseId: E["goblet-squat"]!, sortOrder: 0, sets: 3, repTarget: 12, targetRpe: 8, restSec: 90 },
                { exerciseId: E["step-up"]!, sortOrder: 1, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                { exerciseId: E["walking-lunge"]!, sortOrder: 2, sets: 3, repTarget: 12, targetRpe: 8, restSec: 90 },
                { exerciseId: E["hip-thrust"]!, sortOrder: 3, sets: 3, repTarget: 12, targetRpe: 8, restSec: 90 },
                { exerciseId: E["hanging-knee-raise"]!, sortOrder: 4, sets: 3, repTarget: 12, targetRpe: 8, restSec: 60 },
              ],
            },
          },
          {
            sortOrder: 1,
            label: "Athletic B — push",
            exercises: {
              create: [
                { exerciseId: E["landmine-press"]!, sortOrder: 0, sets: 4, repTarget: 10, targetRpe: 8, restSec: 90 },
                { exerciseId: E["dumbbell-bench-press"]!, sortOrder: 1, sets: 3, repTarget: 12, targetRpe: 8, restSec: 90 },
                { exerciseId: E["arnold-press"]!, sortOrder: 2, sets: 3, repTarget: 10, targetRpe: 9, restSec: 90 },
                { exerciseId: E["lateral-raise"]!, sortOrder: 3, sets: 3, repTarget: 15, targetRpe: 9, restSec: 60 },
              ],
            },
          },
          {
            sortOrder: 2,
            label: "Athletic C — pull & hinge",
            exercises: {
              create: [
                { exerciseId: E["pull-up"]!, sortOrder: 0, sets: 4, repTarget: 8, targetRpe: 8, restSec: 120 },
                { exerciseId: E["chin-up"]!, sortOrder: 1, sets: 3, repTarget: 8, targetRpe: 8, restSec: 120 },
                { exerciseId: E["romanian-deadlift"]!, sortOrder: 2, sets: 3, repTarget: 10, targetRpe: 8, restSec: 120 },
                { exerciseId: E["barbell-row"]!, sortOrder: 3, sets: 3, repTarget: 10, targetRpe: 8, restSec: 90 },
                { exerciseId: E["ab-wheel-rollout"]!, sortOrder: 4, sets: 3, repTarget: 10, targetRpe: 8, restSec: 60 },
              ],
            },
          },
        ],
      },
    },
    {
      name: SEED_TEMPLATE_PROGRAM_NAMES[13],
      durationWeeks: 15,
      blocks: trainingBlocksForWeeks(15),
      days: {
        create: [
          {
            sortOrder: 0,
            label: "Foundation A",
            exercises: {
              create: [
                { exerciseId: E["goblet-squat"]!, sortOrder: 0, sets: 3, repTarget: 12, targetRpe: 7.5, restSec: 90 },
                { exerciseId: E["landmine-press"]!, sortOrder: 1, sets: 3, repTarget: 12, targetRpe: 7.5, restSec: 90 },
                { exerciseId: E["dumbbell-bench-press"]!, sortOrder: 2, sets: 3, repTarget: 10, targetRpe: 7.5, restSec: 90 },
                { exerciseId: E["romanian-deadlift"]!, sortOrder: 3, sets: 3, repTarget: 10, targetRpe: 7.5, restSec: 120 },
              ],
            },
          },
          {
            sortOrder: 1,
            label: "Foundation B",
            exercises: {
              create: [
                { exerciseId: E["squat"]!, sortOrder: 0, sets: 3, repTarget: 8, targetRpe: 7.5, pctOf1rm: 68, restSec: 150 },
                { exerciseId: E["pull-up"]!, sortOrder: 1, sets: 3, repTarget: 6, targetRpe: 7.5, restSec: 120 },
                { exerciseId: E["overhead-press"]!, sortOrder: 2, sets: 3, repTarget: 8, targetRpe: 7.5, restSec: 120 },
                { exerciseId: E["glute-bridge"]!, sortOrder: 3, sets: 3, repTarget: 15, targetRpe: 8, restSec: 60 },
              ],
            },
          },
          {
            sortOrder: 2,
            label: "Foundation C",
            exercises: {
              create: [
                { exerciseId: E["deadlift"]!, sortOrder: 0, sets: 2, repTarget: 6, targetRpe: 7.5, pctOf1rm: 72, restSec: 200 },
                { exerciseId: E["bench-press"]!, sortOrder: 1, sets: 3, repTarget: 8, targetRpe: 7.5, pctOf1rm: 70, restSec: 120 },
                { exerciseId: E["barbell-row"]!, sortOrder: 2, sets: 3, repTarget: 10, targetRpe: 7.5, restSec: 90 },
                { exerciseId: E["walking-lunge"]!, sortOrder: 3, sets: 2, repTarget: 10, targetRpe: 7.5, restSec: 90 },
              ],
            },
          },
        ],
      },
    },
    {
      name: SEED_TEMPLATE_PROGRAM_NAMES[14],
      durationWeeks: 10,
      blocks: trainingBlocksForWeeks(10),
      days: {
        create: [
          {
            sortOrder: 0,
            label: "Upper strength",
            exercises: {
              create: [
                { exerciseId: E["bench-press"]!, sortOrder: 0, sets: 5, repTarget: 3, targetRpe: 8.5, pctOf1rm: 86, restSec: 220 },
                { exerciseId: E["pendlay-row"]!, sortOrder: 1, sets: 5, repTarget: 3, targetRpe: 8.5, pctOf1rm: 82, restSec: 200 },
                { exerciseId: E["overhead-press"]!, sortOrder: 2, sets: 4, repTarget: 4, targetRpe: 8.5, pctOf1rm: 82, restSec: 180 },
                { exerciseId: E["pull-up"]!, sortOrder: 3, sets: 4, repTarget: 5, targetRpe: 8.5, restSec: 120 },
              ],
            },
          },
          {
            sortOrder: 1,
            label: "Lower strength",
            exercises: {
              create: [
                { exerciseId: E["squat"]!, sortOrder: 0, sets: 5, repTarget: 3, targetRpe: 8.5, pctOf1rm: 86, restSec: 240 },
                { exerciseId: E["deadlift"]!, sortOrder: 1, sets: 3, repTarget: 3, targetRpe: 8.5, pctOf1rm: 86, restSec: 260 },
                { exerciseId: E["front-squat"]!, sortOrder: 2, sets: 3, repTarget: 5, targetRpe: 8, restSec: 180 },
              ],
            },
          },
          {
            sortOrder: 2,
            label: "Upper volume",
            exercises: {
              create: [
                { exerciseId: E["incline-barbell-bench"]!, sortOrder: 0, sets: 4, repTarget: 6, targetRpe: 8, restSec: 120 },
                { exerciseId: E["t-bar-row"]!, sortOrder: 1, sets: 4, repTarget: 8, targetRpe: 8, restSec: 90 },
                { exerciseId: E["arnold-press"]!, sortOrder: 2, sets: 3, repTarget: 8, targetRpe: 8, restSec: 90 },
                { exerciseId: E["chin-up"]!, sortOrder: 3, sets: 3, repTarget: 8, targetRpe: 8, restSec: 120 },
              ],
            },
          },
          {
            sortOrder: 3,
            label: "Lower volume",
            exercises: {
              create: [
                { exerciseId: E["pause-squat"]!, sortOrder: 0, sets: 4, repTarget: 4, targetRpe: 8, restSec: 200 },
                { exerciseId: E["sumo-deadlift"]!, sortOrder: 1, sets: 3, repTarget: 5, targetRpe: 8, restSec: 200 },
                { exerciseId: E["bulgarian-split-squat"]!, sortOrder: 2, sets: 3, repTarget: 8, targetRpe: 8, restSec: 90 },
                { exerciseId: E["romanian-deadlift"]!, sortOrder: 3, sets: 3, repTarget: 8, targetRpe: 8, restSec: 150 },
              ],
            },
          },
        ],
      },
    },
  ];
}
