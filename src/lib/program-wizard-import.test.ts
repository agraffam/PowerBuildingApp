import { describe, expect, it } from "vitest";
import { defaultMesocycleBlocks } from "@/lib/program-periodization";
import { parseProgramWizardJson } from "@/lib/program-wizard-import";

const minimalValidJson = () =>
  JSON.stringify({
    name: " Import test ",
    durationWeeks: 8,
    blocks: defaultMesocycleBlocks(8, false),
    days: [
      {
        label: "Day A",
        exercises: [
          {
            exerciseSlug: "bench-press",
            sets: 3,
            repTarget: 8,
            targetRpe: 8,
            pctOf1rm: null,
            restSec: 120,
          },
        ],
      },
    ],
  });

describe("parseProgramWizardJson", () => {
  it("accepts valid payload and trims name", () => {
    const r = parseProgramWizardJson(minimalValidJson());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.name).toBe("Import test");
    expect(r.data.days[0]?.exercises[0]?.exerciseSlug).toBe("bench-press");
    expect(r.data.days[0]?.exercises[0]).not.toHaveProperty("programExerciseId");
  });

  it("rejects invalid JSON", () => {
    const r = parseProgramWizardJson("{");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/invalid json/i);
  });

  it("rejects mesocycle gaps", () => {
    const bad = JSON.stringify({
      name: "x",
      durationWeeks: 8,
      blocks: [{ blockType: "HYPERTROPHY", startWeek: 1, endWeek: 4 }],
      days: [
        {
          label: "D",
          exercises: [{ exerciseSlug: "squat", sets: 3 }],
        },
      ],
    });
    const r = parseProgramWizardJson(bad);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.toLowerCase()).toContain("gap");
  });

  it("rejects empty exercise list on a day", () => {
    const bad = JSON.stringify({
      name: "x",
      durationWeeks: 8,
      blocks: defaultMesocycleBlocks(8, false),
      days: [{ label: "Empty", exercises: [] }],
    });
    const r = parseProgramWizardJson(bad);
    expect(r.ok).toBe(false);
  });
});
