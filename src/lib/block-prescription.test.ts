import { describe, expect, it } from "vitest";
import { BlockType } from "@prisma/client";
import {
  isDeloadCalendarWeek,
  resolveProgramExercisePrescription,
} from "./block-prescription";
import {
  DELOAD_CARDIO_BOUT_FACTOR,
  DELOAD_CARDIO_DURATION_FACTOR,
} from "./block-prescription-templates";

const strengthBlocks = [
  { blockType: BlockType.HYPERTROPHY, startWeek: 1, endWeek: 3 },
  { blockType: BlockType.STRENGTH, startWeek: 4, endWeek: 8 },
];

describe("isDeloadCalendarWeek", () => {
  it("is false when deload off", () => {
    expect(isDeloadCalendarWeek(null, 4)).toBe(false);
  });

  it("is true on multiples of interval", () => {
    expect(isDeloadCalendarWeek(4, 4)).toBe(true);
    expect(isDeloadCalendarWeek(4, 8)).toBe(true);
    expect(isDeloadCalendarWeek(4, 5)).toBe(false);
  });
});

describe("resolveProgramExercisePrescription", () => {
  it("passes through templates when autoBlockPrescriptions is false", () => {
    const r = resolveProgramExercisePrescription({
      programExercise: {
        sets: 4,
        repTarget: 10,
        targetRpe: 8,
        pctOf1rm: 70,
        restSec: 120,
        targetDurationSec: null,
        targetCalories: null,
        loadRole: null,
      },
      exerciseKind: "STRENGTH",
      autoBlockPrescriptions: false,
      deloadIntervalWeeks: 4,
      blocks: strengthBlocks,
      instanceWeekIndex: 3,
    });
    expect(r.sets).toBe(4);
    expect(r.repTarget).toBe(10);
    expect(r.targetRpe).toBe(8);
    expect(r.pctOf1rm).toBe(70);
    expect(r.isDeloadWeek).toBe(true);
  });

  it("applies strength mesocycle for compounds", () => {
    const r = resolveProgramExercisePrescription({
      programExercise: {
        sets: 4,
        repTarget: 5,
        targetRpe: 8,
        pctOf1rm: 78,
        restSec: 180,
        targetDurationSec: null,
        targetCalories: null,
        loadRole: "COMPOUND",
      },
      exerciseKind: "STRENGTH",
      autoBlockPrescriptions: true,
      deloadIntervalWeeks: null,
      blocks: strengthBlocks,
      instanceWeekIndex: 3,
    });
    expect(r.blockType).toBe(BlockType.STRENGTH);
    expect(r.isDeloadWeek).toBe(false);
    expect(r.repTarget).toBe(4);
    expect(r.repTarget).toBeGreaterThanOrEqual(3);
    expect(r.repTarget).toBeLessThanOrEqual(6);
  });

  it("applies cardio deload factors", () => {
    const sets = 4;
    const duration = 600;
    const r = resolveProgramExercisePrescription({
      programExercise: {
        sets,
        repTarget: null,
        targetRpe: null,
        pctOf1rm: null,
        restSec: null,
        targetDurationSec: duration,
        targetCalories: null,
        loadRole: "CARDIO",
      },
      exerciseKind: "CARDIO",
      autoBlockPrescriptions: true,
      deloadIntervalWeeks: 4,
      blocks: strengthBlocks,
      instanceWeekIndex: 3,
    });
    expect(r.isDeloadWeek).toBe(true);
    expect(r.sets).toBe(Math.max(1, Math.round(sets * DELOAD_CARDIO_BOUT_FACTOR)));
    expect(r.targetDurationSec).toBe(
      Math.max(30, Math.round(duration * DELOAD_CARDIO_DURATION_FACTOR)),
    );
  });

  it("supports linear MRV/MEV progression across a block", () => {
    const early = resolveProgramExercisePrescription({
      programExercise: {
        sets: 4,
        repTarget: 8,
        targetRpe: 8,
        pctOf1rm: 72,
        restSec: 150,
        targetDurationSec: null,
        targetCalories: null,
        loadRole: "COMPOUND",
      },
      exerciseKind: "STRENGTH",
      autoBlockPrescriptions: true,
      deloadIntervalWeeks: null,
      blocks: strengthBlocks,
      instanceWeekIndex: 3,
      periodizationStyle: "LINEAR",
    });
    const late = resolveProgramExercisePrescription({
      programExercise: {
        sets: 4,
        repTarget: 8,
        targetRpe: 8,
        pctOf1rm: 72,
        restSec: 150,
        targetDurationSec: null,
        targetCalories: null,
        loadRole: "COMPOUND",
      },
      exerciseKind: "STRENGTH",
      autoBlockPrescriptions: true,
      deloadIntervalWeeks: null,
      blocks: strengthBlocks,
      instanceWeekIndex: 7,
      periodizationStyle: "LINEAR",
    });
    expect(late.sets).toBeGreaterThanOrEqual(early.sets);
  });

  it("supports alternating weekly load behavior", () => {
    const w1 = resolveProgramExercisePrescription({
      programExercise: {
        sets: 4,
        repTarget: 8,
        targetRpe: 8,
        pctOf1rm: 72,
        restSec: 150,
        targetDurationSec: null,
        targetCalories: null,
        loadRole: "COMPOUND",
      },
      exerciseKind: "STRENGTH",
      autoBlockPrescriptions: true,
      deloadIntervalWeeks: null,
      blocks: strengthBlocks,
      instanceWeekIndex: 4,
      periodizationStyle: "ALTERNATING",
    });
    const w2 = resolveProgramExercisePrescription({
      programExercise: {
        sets: 4,
        repTarget: 8,
        targetRpe: 8,
        pctOf1rm: 72,
        restSec: 150,
        targetDurationSec: null,
        targetCalories: null,
        loadRole: "COMPOUND",
      },
      exerciseKind: "STRENGTH",
      autoBlockPrescriptions: true,
      deloadIntervalWeeks: null,
      blocks: strengthBlocks,
      instanceWeekIndex: 5,
      periodizationStyle: "ALTERNATING",
    });
    expect(w1.sets).not.toBe(w2.sets);
  });
});
