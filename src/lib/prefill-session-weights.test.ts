import { beforeEach, describe, expect, it, vi } from "vitest";

const findUniqueMock = vi.fn();
const updateManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    loggedSet: {
      findUnique: findUniqueMock,
      updateMany: updateManyMock,
    },
  },
}));

vi.mock("@/lib/bodyweight-override-maps", () => ({
  loadBodyweightOverrideMaps: vi.fn(async () => ({
    sessionByProgramExerciseId: new Map(),
    instanceByProgramExerciseId: new Map(),
  })),
}));

vi.mock("@/lib/exercise-bodyweight", () => ({
  effectiveUseBodyweightResolved: vi.fn(() => false),
}));

import { mirrorSetWeightToFollowingUncompletedSets } from "./prefill-session-weights";

describe("mirrorSetWeightToFollowingUncompletedSets", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    updateManyMock.mockReset();
    updateManyMock.mockResolvedValue({ count: 2 });
  });

  it("updates only following unfinished sets in same exercise", async () => {
    findUniqueMock.mockResolvedValue({
      id: "s2",
      workoutSessionId: "sess1",
      programExerciseId: "pe1",
      setIndex: 1,
      weight: 225,
      weightUnit: "LB",
      workoutSession: { programInstanceId: "pi1", programInstance: { userId: "u1" } },
      programExercise: { useBodyweight: false, exercise: { isBodyweight: false } },
    });

    await mirrorSetWeightToFollowingUncompletedSets("sess1", "s2", "u1");

    expect(updateManyMock).toHaveBeenCalledWith({
      where: {
        workoutSessionId: "sess1",
        programExerciseId: "pe1",
        done: false,
        setIndex: { gt: 1 },
      },
      data: {
        weight: 225,
        weightUnit: "LB",
      },
    });
  });
});
