import { describe, expect, it } from "vitest";
import { defaultRestDurationsByRpe, mergeRestDurationsByRpe, RPE_REST_SEC_OPTIONS } from "./rest-by-rpe";

describe("defaultRestDurationsByRpe", () => {
  it("anchors RPE 8 and 8.5 to base rest (snapped)", () => {
    const m = defaultRestDurationsByRpe(180);
    expect(m["8"]).toBe(180);
    expect(m["8.5"]).toBe(180);
  });

  it("steps by 15s per half-RPE below 8 and above 8.5", () => {
    const m = defaultRestDurationsByRpe(180);
    expect(m["7.5"]).toBe(165);
    expect(m["9"]).toBe(195);
  });

  it("keeps values on the 15s ladder", () => {
    for (const k of Object.keys(defaultRestDurationsByRpe(120))) {
      expect(RPE_REST_SEC_OPTIONS as readonly number[]).toContain(defaultRestDurationsByRpe(120)[k]!);
    }
  });
});

describe("mergeRestDurationsByRpe", () => {
  it("uses base for defaults when stored is empty", () => {
    const m = mergeRestDurationsByRpe(null, 120);
    expect(m["8"]).toBe(120);
    expect(m["8.5"]).toBe(120);
  });
});
