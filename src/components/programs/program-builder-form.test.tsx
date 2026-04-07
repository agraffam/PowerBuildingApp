import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProgramBuilderForm } from "./program-builder-form";
import type { ProgramWizardPayload } from "@/lib/program-wizard-types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const INITIAL: ProgramWizardPayload = {
  name: "Test Program",
  durationWeeks: 8,
  deloadIntervalWeeks: 5,
  autoBlockPrescriptions: true,
  blocks: [
    { blockType: "HYPERTROPHY", startWeek: 1, endWeek: 4 },
    { blockType: "STRENGTH", startWeek: 5, endWeek: 8 },
  ],
  days: [
    {
      label: "Day 1",
      exercises: [{ exerciseSlug: "bench-press", sets: 3, repTarget: 8, targetRpe: 8, restSec: 120 }],
    },
  ],
};

describe("ProgramBuilderForm", () => {
  it("keeps structural editing flow available in edit mode", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ slug: "bench-press", name: "Bench Press", kind: "STRENGTH" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const user = userEvent.setup();

    renderWithClient(<ProgramBuilderForm mode="edit" programId="p1" initial={INITIAL} />);

    await user.click(screen.getByRole("button", { name: /^next$/i }));
    expect(await screen.findByText("Blocks")).toBeInTheDocument();
    expect(screen.queryByText("Structure locked")).not.toBeInTheDocument();
  });
});
