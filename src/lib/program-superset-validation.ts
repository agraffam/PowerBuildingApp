import type { WizardDay } from "@/lib/program-wizard-types";

type Ex = WizardDay["exercises"][number];

/** Contiguous exercises with the same non-empty supersetGroup must share the same set count. */
export function validateSupersetSets(
  days: WizardDay[],
): { ok: true } | { ok: false; error: string } {
  for (let di = 0; di < days.length; di++) {
    const exs = days[di]!.exercises;
    let run: Ex[] = [];

    const validateRun = (label: string) => {
      if (run.length < 2) return { ok: true as const };
      const s0 = run[0]!.sets;
      for (const x of run) {
        if (x.sets !== s0) {
          return {
            ok: false as const,
            error: `Day ${di + 1}: exercises in superset "${label}" must use the same number of sets (${s0} vs ${x.sets}).`,
          };
        }
      }
      return { ok: true as const };
    };

    for (const e of exs) {
      const g = e.supersetGroup?.trim() || null;
      if (g && run.length > 0 && (run[0]!.supersetGroup?.trim() || null) === g) {
        run.push(e);
      } else {
        const prevLabel = run[0]?.supersetGroup?.trim() || "";
        const v = validateRun(prevLabel);
        if (!v.ok) return v;
        run = g ? [e] : [];
      }
    }
    const lastLabel = run[0]?.supersetGroup?.trim() || "";
    const v = validateRun(lastLabel);
    if (!v.ok) return v;
  }
  return { ok: true };
}
