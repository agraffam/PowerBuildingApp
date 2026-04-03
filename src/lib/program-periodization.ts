/** Mesocycle / block rules for saved programs (progression context). */

export const MIN_PROGRAM_WEEKS = 6;
export const MAX_PROGRAM_WEEKS = 12;

export function validateProgramDurationWeeks(
  durationWeeks: number,
): { ok: true } | { ok: false; error: string } {
  if (
    !Number.isInteger(durationWeeks) ||
    durationWeeks < MIN_PROGRAM_WEEKS ||
    durationWeeks > MAX_PROGRAM_WEEKS
  ) {
    return {
      ok: false,
      error: `Program length must be between ${MIN_PROGRAM_WEEKS} and ${MAX_PROGRAM_WEEKS} weeks.`,
    };
  }
  return { ok: true };
}

export type BlockWeekRange = { startWeek: number; endWeek: number };

/** Blocks must partition weeks 1…duration with no gaps or overlaps (linear periodization scaffold). */
export function validateMesocycleBlocks(
  durationWeeks: number,
  blocks: BlockWeekRange[],
): { ok: true } | { ok: false; error: string } {
  const dur = validateProgramDurationWeeks(durationWeeks);
  if (!dur.ok) return dur;

  if (!blocks?.length) {
    return { ok: false, error: "At least one training block is required for periodization." };
  }

  for (const b of blocks) {
    if (!Number.isInteger(b.startWeek) || !Number.isInteger(b.endWeek)) {
      return { ok: false, error: "Block start and end weeks must be whole numbers." };
    }
    if (b.startWeek < 1 || b.endWeek > durationWeeks || b.startWeek > b.endWeek) {
      return {
        ok: false,
        error: `Each block must fall within weeks 1–${durationWeeks} with start ≤ end.`,
      };
    }
  }

  const covered = new Set<number>();
  const sorted = [...blocks].sort((a, b) => a.startWeek - b.startWeek || a.endWeek - b.endWeek);

  for (const b of sorted) {
    for (let w = b.startWeek; w <= b.endWeek; w++) {
      if (covered.has(w)) {
        return { ok: false, error: "Mesocycle blocks must not overlap the same week." };
      }
      covered.add(w);
    }
  }

  for (let w = 1; w <= durationWeeks; w++) {
    if (!covered.has(w)) {
      return { ok: false, error: `Week ${w} is not assigned to any block (gap in periodization).` };
    }
  }

  return { ok: true };
}
