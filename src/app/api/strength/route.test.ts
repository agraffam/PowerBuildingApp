import { beforeEach, describe, expect, it, vi } from "vitest";

const { findManyMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireUserId: vi.fn(async () => ({ userId: "u1" })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    exercise: {
      findMany: findManyMock,
    },
  },
}));

import { GET } from "./route";

describe("GET /api/strength", () => {
  beforeEach(() => {
    findManyMock.mockReset();
    findManyMock.mockResolvedValue([]);
  });

  it("filters out cardio and bodyweight exercises", async () => {
    await GET(new Request("http://localhost/api/strength"));

    expect(findManyMock).toHaveBeenCalledTimes(1);
    const arg = findManyMock.mock.calls[0]?.[0];
    expect(arg.where.kind).toEqual({ not: "CARDIO" });
    expect(arg.where.isBodyweight).toBe(false);
  });
});
