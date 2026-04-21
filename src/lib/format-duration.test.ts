import { describe, expect, it } from "vitest";
import { formatSecAsMmSs, parseDurationInputToSec } from "./format-duration";

describe("formatSecAsMmSs", () => {
  it("formats minutes and zero-padded seconds", () => {
    expect(formatSecAsMmSs(300)).toBe("5:00");
    expect(formatSecAsMmSs(45)).toBe("0:45");
  });

  it("returns empty for nullish", () => {
    expect(formatSecAsMmSs(null)).toBe("");
    expect(formatSecAsMmSs(undefined)).toBe("");
  });
});

describe("parseDurationInputToSec", () => {
  it("parses m:ss", () => {
    expect(parseDurationInputToSec("5:00")).toBe(300);
    expect(parseDurationInputToSec("0:30")).toBe(30);
  });

  it("parses plain seconds", () => {
    expect(parseDurationInputToSec("45")).toBe(45);
    expect(parseDurationInputToSec("90")).toBe(90);
  });

  it("parses compact mmss shorthand", () => {
    expect(parseDurationInputToSec("500")).toBe(300);
    expect(parseDurationInputToSec("1234")).toBe(754);
    expect(parseDurationInputToSec("045")).toBe(45);
  });

  it("returns null for empty", () => {
    expect(parseDurationInputToSec("")).toBe(null);
    expect(parseDurationInputToSec("   ")).toBe(null);
  });
});
