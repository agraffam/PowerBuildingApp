import type { ReactElement } from "react";
import { describe, beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ExerciseLibrarySheet } from "./exercise-library-sheet";
import { useWorkoutSessionStore } from "@/stores/workout-session-store";

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function mockJsonResponse(data: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
  }) as Promise<Response>;
}

describe("ExerciseLibrarySheet", () => {
  beforeEach(() => {
    useWorkoutSessionStore.setState({
      libraryExerciseSlug: null,
      restEndsAt: null,
      isRestRunning: false,
    });
    vi.restoreAllMocks();
  });

  it("does not request top stats when browsing all exercises", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/exercises/top")) {
        return mockJsonResponse({}) as Promise<Response>;
      }
      if (url.includes("/api/exercises?")) {
        return mockJsonResponse([{ id: "1", name: "Squat", slug: "squat", muscleTags: "legs" }]);
      }
      return mockJsonResponse([]) as Promise<Response>;
    });

    useWorkoutSessionStore.setState({ libraryExerciseSlug: "__all__" });
    renderWithClient(<ExerciseLibrarySheet />);

    await waitFor(() => {
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/api/exercises?"))).toBe(true);
    });

    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/api/exercises/top"))).toBe(
      false,
    );
  });

  it("loads history and shows recent sets for a specific exercise", async () => {
    const performedAt = "2024-06-01T14:00:00.000Z";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/exercises/top")) {
        return mockJsonResponse({
          exercise: { name: "Bench Press", slug: "bench-press" },
          bestSet: {
            weight: 225,
            weightUnit: "LB",
            reps: 5,
            rpe: 8,
            performedAt,
          },
          recent: [
            {
              weight: 225,
              weightUnit: "LB",
              reps: 5,
              rpe: 8,
              performedAt,
            },
          ],
        }) as Promise<Response>;
      }
      return mockJsonResponse([]) as Promise<Response>;
    });

    useWorkoutSessionStore.setState({ libraryExerciseSlug: "bench-press" });
    renderWithClient(<ExerciseLibrarySheet />);

    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/api/exercises?"))).toBe(false);

    expect(await screen.findByText("Recent sessions")).toBeInTheDocument();
    expect(screen.getAllByText(/225/).length).toBeGreaterThanOrEqual(1);
    // StrictMode double-mount in tests can duplicate portal content; assert at least one match.
    expect(screen.getAllByText(/Best est\. set/).length).toBeGreaterThanOrEqual(1);
  });

  it("shows retry when history request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/exercises/top")) {
        return Promise.resolve({ ok: false, status: 500 }) as Promise<Response>;
      }
      return mockJsonResponse([]) as Promise<Response>;
    });

    useWorkoutSessionStore.setState({ libraryExerciseSlug: "deadlift" });
    renderWithClient(<ExerciseLibrarySheet />);

    expect(await screen.findByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
