import { describe, expect, it } from "vitest";
import { persistRepTargetRpe } from "./wizard-exercise-persist";

describe("persistRepTargetRpe", () => {
  it("allows null for cardio", () => {
    expect(persistRepTargetRpe("CARDIO", null, null)).toEqual({
      repTarget: null,
      targetRpe: null,
    });
  });

  it("rounds finite cardio values", () => {
    expect(persistRepTargetRpe("CARDIO", 9.2, 7.5)).toEqual({
      repTarget: 9,
      targetRpe: 7.5,
    });
  });

  it("defaults strength when missing", () => {
    expect(persistRepTargetRpe("STRENGTH", undefined, undefined)).toEqual({
      repTarget: 8,
      targetRpe: 8,
    });
  });

  it("clamps strength RPE", () => {
    expect(persistRepTargetRpe("STRENGTH", 5, 4)).toEqual({
      repTarget: 5,
      targetRpe: 6,
    });
    expect(persistRepTargetRpe("STRENGTH", 5, 11)).toEqual({
      repTarget: 5,
      targetRpe: 10,
    });
  });
});
