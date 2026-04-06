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

export type BlockWithType = BlockWeekRange & { blockType: string };

/** null/undefined = deload off; else 4–6. */
export function validateDeloadIntervalWeeks(
  n: number | null | undefined,
): { ok: true } | { ok: false; error: string } {
  if (n === null || n === undefined) return { ok: true };
  if (!Number.isInteger(n) || n < 4 || n > 6) {
    return {
      ok: false,
      error: "Deload interval must be off or a whole number from 4 to 6 weeks.",
    };
  }
  return { ok: true };
}

/**
 * If any PEAKING block exists, it must be the sole final segment (last when sorted by startWeek).
 */
export function validatePeakingBlockOrder(
  blocks: BlockWithType[],
): { ok: true } | { ok: false; error: string } {
  const peak = blocks.filter((b) => b.blockType === "PEAKING");
  if (peak.length === 0) return { ok: true };
  if (peak.length > 1) {
    return { ok: false, error: "Only one peaking block is allowed." };
  }
  const sorted = [...blocks].sort((a, b) => a.startWeek - b.startWeek || a.endWeek - b.endWeek);
  const last = sorted[sorted.length - 1];
  if (!last || last.blockType !== "PEAKING") {
    return { ok: false, error: "Peaking must be the last mesocycle (final weeks of the program)." };
  }
  return { ok: true };
}

/** Default blocks: first half hypertrophy, second half strength; optional final peaking weeks. */
export function defaultMesocycleBlocks(
  durationWeeks: number,
  includePeaking?: boolean,
): BlockWithType[] {
  if (includePeaking && durationWeeks >= 10) {
    const peakLen = durationWeeks >= 12 ? 2 : 1;
    const strengthEnd = durationWeeks - peakLen;
    const hEnd = Math.max(1, Math.floor(strengthEnd / 2));
    const sStart = Math.min(strengthEnd, hEnd + 1);
    return [
      { blockType: "HYPERTROPHY", startWeek: 1, endWeek: hEnd },
      { blockType: "STRENGTH", startWeek: sStart, endWeek: strengthEnd },
      { blockType: "PEAKING", startWeek: strengthEnd + 1, endWeek: durationWeeks },
    ];
  }
  const hEnd = Math.max(1, Math.floor(durationWeeks / 2));
  const sStart = Math.min(durationWeeks, hEnd + 1);
  return [
    { blockType: "HYPERTROPHY", startWeek: 1, endWeek: hEnd },
    { blockType: "STRENGTH", startWeek: sStart, endWeek: durationWeeks },
  ];
}

