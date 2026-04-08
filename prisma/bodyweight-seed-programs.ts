/**
 * Calisthenics-oriented templates (pull-up bar / dip station / low bar for rows assumed).
 */
import type { Prisma } from "@prisma/client";
import { trainingBlocksForWeeks } from "./home-gym-seed-programs";

type E = Record<string, string>;

const BW_WEEKS = 10;

/** Program line: RPE-style prescription without pctOf1rm (auto-block friendly). */
function pe(
  exerciseId: string,
  sortOrder: number,
  sets: number,
  repTarget: number,
  targetRpe: number,
  restSec: number,
  useBodyweight?: boolean,
) {
  return {
    exercise: { connect: { id: exerciseId } },
    sortOrder,
    sets,
    repTarget,
    targetRpe,
    restSec,
    ...(useBodyweight === true ? { useBodyweight: true } : {}),
  } satisfies Prisma.ProgramExerciseCreateWithoutProgramDayInput;
}

export function bodyweightProgramCreateData(
  E: E,
): (Prisma.ProgramCreateInput & { seedKey: string })[] {
  const blocks = trainingBlocksForWeeks(BW_WEEKS);

  return [
    {
      seedKey: "seed-bw-full-body-3",
      name: "Bodyweight — Full body (3 day)",
      durationWeeks: BW_WEEKS,
      blocks,
      days: {
        create: [
          {
            sortOrder: 0,
            label: "Full body A — Squat / push / pull",
            exercises: {
              create: [
                pe(E["air-squat"]!, 0, 4, 20, 8, 90),
                pe(E["push-up"]!, 1, 4, 12, 8, 90),
                pe(E["pull-up"]!, 2, 4, 8, 8, 120),
                pe(E["glute-bridge"]!, 3, 3, 15, 9, 60),
                pe(E["hanging-leg-raise"]!, 4, 3, 12, 9, 60),
              ],
            },
          },
          {
            sortOrder: 1,
            label: "Full body B — Single leg / chin / dip",
            exercises: {
              create: [
                pe(E["bulgarian-split-squat"]!, 0, 3, 10, 8, 90, true),
                pe(E["chin-up"]!, 1, 4, 8, 8, 120),
                pe(E["chest-dip"]!, 2, 3, 10, 8, 120),
                pe(E["nordic-hamstring-curl"]!, 3, 3, 8, 9, 90),
                pe(E["ab-wheel-rollout"]!, 4, 3, 10, 9, 60),
              ],
            },
          },
          {
            sortOrder: 2,
            label: "Full body C — Lunge / rows / arms",
            exercises: {
              create: [
                pe(E["walking-lunge"]!, 0, 3, 12, 8, 90, true),
                pe(E["neutral-grip-pull-up"]!, 1, 4, 8, 8, 120),
                pe(E["inverted-row"]!, 2, 4, 12, 8, 90),
                pe(E["triceps-dip"]!, 3, 3, 10, 8, 90),
                pe(E["hanging-knee-raise"]!, 4, 3, 15, 9, 60),
              ],
            },
          },
        ],
      },
    },
    {
      seedKey: "seed-bw-full-body-4",
      name: "Bodyweight — Full body (4 day)",
      durationWeeks: BW_WEEKS,
      blocks,
      days: {
        create: [
          {
            sortOrder: 0,
            label: "Full body 1",
            exercises: {
              create: [
                pe(E["air-squat"]!, 0, 3, 20, 8, 75),
                pe(E["push-up"]!, 1, 3, 15, 8, 75),
                pe(E["pull-up"]!, 2, 3, 8, 8, 120),
                pe(E["glute-bridge"]!, 3, 3, 15, 9, 60),
              ],
            },
          },
          {
            sortOrder: 1,
            label: "Full body 2",
            exercises: {
              create: [
                pe(E["walking-lunge"]!, 0, 3, 10, 8, 90, true),
                pe(E["chin-up"]!, 1, 3, 8, 8, 120),
                pe(E["inverted-row"]!, 2, 3, 12, 8, 90),
                pe(E["hanging-knee-raise"]!, 3, 3, 12, 9, 60),
              ],
            },
          },
          {
            sortOrder: 2,
            label: "Full body 3",
            exercises: {
              create: [
                pe(E["bulgarian-split-squat"]!, 0, 3, 8, 8, 90, true),
                pe(E["neutral-grip-pull-up"]!, 1, 3, 8, 8, 120),
                pe(E["chest-dip"]!, 2, 3, 8, 8, 120),
                pe(E["ab-wheel-rollout"]!, 3, 3, 8, 9, 60),
              ],
            },
          },
          {
            sortOrder: 3,
            label: "Full body 4",
            exercises: {
              create: [
                pe(E["air-squat"]!, 0, 3, 15, 8, 75),
                pe(E["push-up"]!, 1, 3, 12, 8, 75),
                pe(E["inverted-row"]!, 2, 3, 10, 8, 90),
                pe(E["triceps-dip"]!, 3, 3, 10, 8, 90),
                pe(E["nordic-hamstring-curl"]!, 4, 2, 6, 9, 90),
              ],
            },
          },
        ],
      },
    },
    {
      seedKey: "seed-bw-split-3-ppl",
      name: "Bodyweight — PPL (3 day)",
      durationWeeks: BW_WEEKS,
      blocks,
      days: {
        create: [
          {
            sortOrder: 0,
            label: "Push",
            exercises: {
              create: [
                pe(E["push-up"]!, 0, 4, 15, 8, 90),
                pe(E["chest-dip"]!, 1, 4, 10, 8, 120),
                pe(E["triceps-dip"]!, 2, 3, 12, 8, 90),
                pe(E["hanging-knee-raise"]!, 3, 3, 15, 9, 60),
              ],
            },
          },
          {
            sortOrder: 1,
            label: "Pull",
            exercises: {
              create: [
                pe(E["pull-up"]!, 0, 4, 8, 8, 120),
                pe(E["chin-up"]!, 1, 3, 8, 8, 120),
                pe(E["inverted-row"]!, 2, 4, 12, 8, 90),
                pe(E["hanging-leg-raise"]!, 3, 3, 12, 9, 60),
              ],
            },
          },
          {
            sortOrder: 2,
            label: "Legs",
            exercises: {
              create: [
                pe(E["air-squat"]!, 0, 4, 20, 8, 90),
                pe(E["walking-lunge"]!, 1, 3, 12, 8, 90, true),
                pe(E["bulgarian-split-squat"]!, 2, 3, 10, 8, 90, true),
                pe(E["glute-bridge"]!, 3, 3, 15, 9, 60),
                pe(E["nordic-hamstring-curl"]!, 4, 3, 8, 9, 90),
              ],
            },
          },
        ],
      },
    },
    {
      seedKey: "seed-bw-split-4-ul",
      name: "Bodyweight — Upper / Lower (4 day)",
      durationWeeks: BW_WEEKS,
      blocks,
      days: {
        create: [
          {
            sortOrder: 0,
            label: "Upper A",
            exercises: {
              create: [
                pe(E["push-up"]!, 0, 4, 12, 8, 90),
                pe(E["pull-up"]!, 1, 4, 8, 8, 120),
                pe(E["inverted-row"]!, 2, 3, 12, 8, 90),
                pe(E["chest-dip"]!, 3, 3, 10, 8, 120),
                pe(E["hanging-leg-raise"]!, 4, 3, 12, 9, 60),
              ],
            },
          },
          {
            sortOrder: 1,
            label: "Lower A",
            exercises: {
              create: [
                pe(E["air-squat"]!, 0, 4, 20, 8, 90),
                pe(E["walking-lunge"]!, 1, 3, 12, 8, 90, true),
                pe(E["glute-bridge"]!, 2, 3, 15, 9, 60),
                pe(E["nordic-hamstring-curl"]!, 3, 3, 8, 9, 90),
                pe(E["ab-wheel-rollout"]!, 4, 3, 10, 9, 60),
              ],
            },
          },
          {
            sortOrder: 2,
            label: "Upper B",
            exercises: {
              create: [
                pe(E["chin-up"]!, 0, 4, 8, 8, 120),
                pe(E["neutral-grip-pull-up"]!, 1, 3, 8, 8, 120),
                pe(E["triceps-dip"]!, 2, 3, 12, 8, 90),
                pe(E["push-up"]!, 3, 3, 15, 8, 75),
                pe(E["hanging-knee-raise"]!, 4, 3, 15, 9, 60),
              ],
            },
          },
          {
            sortOrder: 3,
            label: "Lower B",
            exercises: {
              create: [
                pe(E["bulgarian-split-squat"]!, 0, 3, 10, 8, 90, true),
                pe(E["air-squat"]!, 1, 3, 25, 8, 75),
                pe(E["walking-lunge"]!, 2, 3, 10, 8, 90, true),
                pe(E["nordic-hamstring-curl"]!, 3, 3, 6, 9, 90),
                pe(E["glute-bridge"]!, 4, 3, 20, 9, 60),
              ],
            },
          },
        ],
      },
    },
  ];
}
