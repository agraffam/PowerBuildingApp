import { describe, expect, it } from "vitest";
import { pickWeekEndReviewWeekIndex } from "./program-week-state";

describe("pickWeekEndReviewWeekIndex", () => {
  it("uses cursor week when any workout session row exists", () => {
    expect(pickWeekEndReviewWeekIndex(4, 1, 0)).toBe(4);
  });
  it("uses cursor week when any skip exists on cursor week", () => {
    expect(pickWeekEndReviewWeekIndex(4, 0, 1)).toBe(4);
  });
  it("falls back to prior index after week advance before logging anything new", () => {
    expect(pickWeekEndReviewWeekIndex(4, 0, 0)).toBe(3);
  });
  it("does not go below zero", () => {
    expect(pickWeekEndReviewWeekIndex(0, 0, 0)).toBe(0);
  });
});
