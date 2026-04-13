import { describe, expect, it } from "vitest";
import {
  brzyckiOneRm,
  coerceDefaultBarIncrementLb,
  resolveWorkingIncrementLb,
  roundToIncrement,
  suggestNextWeekLoad,
} from "./calculators";

describe("brzyckiOneRm", () => {
  it("returns weight for single rep", () => {
    expect(brzyckiOneRm(300, 1)).toBe(300);
  });

  it("estimates 1RM from a multi-rep set", () => {
    const e = brzyckiOneRm(100, 5);
    expect(e).not.toBeNull();
    expect(e!).toBeGreaterThan(100);
    expect(e!).toBeLessThan(130);
  });

  it("returns null for invalid input", () => {
    expect(brzyckiOneRm(0, 5)).toBeNull();
    expect(brzyckiOneRm(100, 0)).toBeNull();
  });
});

describe("coerceDefaultBarIncrementLb", () => {
  it("keeps standard values", () => {
    expect(coerceDefaultBarIncrementLb(2.5)).toBe(2.5);
    expect(coerceDefaultBarIncrementLb(5)).toBe(5);
    expect(coerceDefaultBarIncrementLb(10)).toBe(10);
  });

  it("falls back to 2.5 for unknown values", () => {
    expect(coerceDefaultBarIncrementLb(7.5)).toBe(2.5);
  });
});

describe("resolveWorkingIncrementLb", () => {
  it("uses exercise override when valid", () => {
    expect(resolveWorkingIncrementLb(10, 2.5)).toBe(10);
  });

  it("falls through to settings when exercise override invalid", () => {
    expect(resolveWorkingIncrementLb(7, 5)).toBe(5);
  });
});

describe("roundToIncrement", () => {
  it("rounds to nearest step", () => {
    expect(roundToIncrement(102.3, 2.5)).toBe(102.5);
    expect(roundToIncrement(100, 5)).toBe(100);
  });
});

describe("suggestNextWeekLoad", () => {
  it("does not bump when reps short of goal", () => {
    const r = suggestNextWeekLoad({
      currentWeight: 100,
      repGoal: 8,
      actualReps: 6,
      prescribedRpe: 8,
      actualRpe: 8,
      plateIncrement: 5,
    });
    expect(r.bumped).toBe(false);
    expect(r.suggested).toBe(100);
  });

  it("bumps and rounds to plate increment when goal met", () => {
    const r = suggestNextWeekLoad({
      currentWeight: 200,
      repGoal: 8,
      actualReps: 8,
      prescribedRpe: 8,
      actualRpe: 8,
      plateIncrement: 5,
    });
    expect(r.bumped).toBe(true);
    expect(r.suggested % 5).toBe(0);
    expect(r.suggested).toBeGreaterThan(200);
  });

  it("uses next plate up when nearest rounding would not exceed current weight", () => {
    const r = suggestNextWeekLoad({
      currentWeight: 201,
      repGoal: 8,
      actualReps: 8,
      prescribedRpe: 8,
      actualRpe: 8,
      plateIncrement: 2.5,
    });
    expect(r.bumped).toBe(true);
    expect(r.suggested % 2.5).toBe(0);
    expect(r.suggested).toBeGreaterThan(201);
  });
});
