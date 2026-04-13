import { describe, expect, it } from "vitest";
import { trainingSessionPatchBodySchema } from "./training-session-patch-schema";

describe("trainingSessionPatchBodySchema", () => {
  it("accepts cancel", () => {
    const r = trainingSessionPatchBodySchema.safeParse({ action: "cancel" });
    expect(r.success).toBe(true);
  });
  it("accepts skipDay", () => {
    const r = trainingSessionPatchBodySchema.safeParse({ action: "skipDay" });
    expect(r.success).toBe(true);
  });
  it("accepts readiness with valid sliders", () => {
    const r = trainingSessionPatchBodySchema.safeParse({
      action: "readiness",
      sleep: 7,
      stress: 3,
      soreness: 4,
    });
    expect(r.success).toBe(true);
  });
  it("rejects readiness out of range", () => {
    const r = trainingSessionPatchBodySchema.safeParse({
      action: "readiness",
      sleep: 11,
      stress: 0,
      soreness: 0,
    });
    expect(r.success).toBe(false);
  });
  it("rejects unknown action", () => {
    const r = trainingSessionPatchBodySchema.safeParse({ action: "nope" });
    expect(r.success).toBe(false);
  });
  it("rejects set with invalid RPE step", () => {
    const r = trainingSessionPatchBodySchema.safeParse({
      action: "set",
      setId: "c1",
      rpe: 7.25,
    });
    expect(r.success).toBe(false);
  });
  it("accepts set with valid half-step RPE", () => {
    const r = trainingSessionPatchBodySchema.safeParse({
      action: "set",
      setId: "c1",
      rpe: 7.5,
    });
    expect(r.success).toBe(true);
  });
  it("accepts set with propagateWeight flag", () => {
    const r = trainingSessionPatchBodySchema.safeParse({
      action: "set",
      setId: "c1",
      weight: 185,
      weightUnit: "LB",
      rpe: 8,
      propagateWeight: true,
    });
    expect(r.success).toBe(true);
  });
  it("accepts set with notes only", () => {
    const r = trainingSessionPatchBodySchema.safeParse({
      action: "set",
      setId: "c1",
      notes: "Paused last rep",
    });
    expect(r.success).toBe(true);
  });
  it("accepts set clearing notes with null", () => {
    const r = trainingSessionPatchBodySchema.safeParse({
      action: "set",
      setId: "c1",
      notes: null,
    });
    expect(r.success).toBe(true);
  });
  it("accepts setExerciseNotes with note text", () => {
    const r = trainingSessionPatchBodySchema.safeParse({
      action: "setExerciseNotes",
      programExerciseId: "pe1",
      notes: "Use straps on back-off sets",
    });
    expect(r.success).toBe(true);
  });
  it("accepts addSet", () => {
    const r = trainingSessionPatchBodySchema.safeParse({
      action: "addSet",
      programExerciseId: "pe1",
    });
    expect(r.success).toBe(true);
  });
});
