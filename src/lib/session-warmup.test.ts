import { describe, expect, it } from "vitest";
import { resolveWarmupFocus, sessionWarmupStorageKey } from "./session-warmup";

describe("sessionWarmupStorageKey", () => {
  it("prefixes session id", () => {
    expect(sessionWarmupStorageKey("abc123")).toBe("pbSessionWarmupDone:abc123");
  });
});

describe("resolveWarmupFocus", () => {
  it("classifies squat family", () => {
    expect(resolveWarmupFocus("squat")).toBe("squat");
    expect(resolveWarmupFocus("front-squat")).toBe("squat");
    expect(resolveWarmupFocus("low-bar-squat")).toBe("squat");
    expect(resolveWarmupFocus("pause-squat")).toBe("squat");
    expect(resolveWarmupFocus("goblet-squat")).toBe("squat");
  });

  it("classifies bench family", () => {
    expect(resolveWarmupFocus("bench-press")).toBe("bench");
    expect(resolveWarmupFocus("close-grip-bench")).toBe("bench");
    expect(resolveWarmupFocus("incline-barbell-bench")).toBe("bench");
    expect(resolveWarmupFocus("dumbbell-bench-press")).toBe("bench");
  });

  it("classifies deadlift family", () => {
    expect(resolveWarmupFocus("deadlift")).toBe("deadlift");
    expect(resolveWarmupFocus("sumo-deadlift")).toBe("deadlift");
    expect(resolveWarmupFocus("romanian-deadlift")).toBe("deadlift");
    expect(resolveWarmupFocus("deficit-deadlift")).toBe("deadlift");
    expect(resolveWarmupFocus("rack-pull")).toBe("deadlift");
  });

  it("normalizes case", () => {
    expect(resolveWarmupFocus("Bench-Press")).toBe("bench");
  });

  it("returns general for accessories and cardio-like slugs", () => {
    expect(resolveWarmupFocus("lat-pulldown")).toBe("general");
    expect(resolveWarmupFocus("bike-erg")).toBe("general");
    expect(resolveWarmupFocus("overhead-press")).toBe("general");
  });
});
