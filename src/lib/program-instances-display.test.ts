import { describe, expect, it } from "vitest";
import { dedupeInstancesByProgramId } from "./program-instances-display";

describe("dedupeInstancesByProgramId", () => {
  it("keeps first occurrence per programId (newest-first input)", () => {
    const rows = [
      { programId: "a", startedAt: "2025-01-02T00:00:00.000Z", id: "2" },
      { programId: "a", startedAt: "2025-01-01T00:00:00.000Z", id: "1" },
      { programId: "b", startedAt: "2025-01-01T00:00:00.000Z", id: "3" },
    ];
    const out = dedupeInstancesByProgramId(rows);
    expect(out.map((r) => r.id)).toEqual(["2", "3"]);
  });
});
