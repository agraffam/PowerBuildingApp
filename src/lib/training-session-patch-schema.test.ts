import { describe, expect, it } from "vitest";
import { trainingSessionPatchBodySchema } from "./training-session-patch-schema";

describe("trainingSessionPatchBodySchema", () => {
  it("accepts cancel", () => {
    const r = trainingSessionPatchBodySchema.safeParse({ action: "cancel" });
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
});
