/**
 * Lifting math: Brzycki e1RM, RPE→%1RM (coach-style lookup), progression, readiness, units.
 * RPE grid adapted from common RTS / autoregulation charts (approximate; tune for your population).
 */

export type WeightUnit = "KG" | "LB";

/** Kilograms per pound (for lb ↔ kg conversion). */
export const KG_PER_LB = 0.45359237;

/** Standard bar / smallest jump in lb for progression and %1RM rounding when working in pounds. */
export const STANDARD_BAR_INCREMENTS_LB = [2.5, 5, 10] as const;
export type StandardBarIncrementLb = (typeof STANDARD_BAR_INCREMENTS_LB)[number];

export function coerceDefaultBarIncrementLb(n: number): StandardBarIncrementLb {
  for (const s of STANDARD_BAR_INCREMENTS_LB) {
    if (Math.abs(n - s) < 0.001) return s;
  }
  return 2.5;
}

/** Per-exercise override or null = use settings default lb increment. */
export function resolveWorkingIncrementLb(
  exerciseBarIncrementLb: number | null | undefined,
  settingsPlateIncrementLb: number,
): StandardBarIncrementLb {
  if (exerciseBarIncrementLb != null) {
    for (const s of STANDARD_BAR_INCREMENTS_LB) {
      if (Math.abs(exerciseBarIncrementLb - s) < 0.001) return s;
    }
  }
  return coerceDefaultBarIncrementLb(settingsPlateIncrementLb);
}

/** Plate step for rounding / progression in the unit the session is displayed in. */
export function resolvePlateIncrementForSession(
  displayUnit: WeightUnit,
  exerciseBarIncrementLb: number | null | undefined,
  settings: { plateIncrementLb: number; plateIncrementKg: number },
): number {
  if (displayUnit === "LB") {
    return resolveWorkingIncrementLb(exerciseBarIncrementLb, settings.plateIncrementLb);
  }
  const kg = settings.plateIncrementKg;
  return kg > 0 ? kg : 2.5;
}

/** RPE keys at 0.5 steps from 6 to 10 */
const RPE_KEYS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;

/**
 * % of 1RM for rep count (row) at RPE (column). Interpolate between reps and RPE.
 * Sources: widely published RPE × reps charts (Mike Tuchscherer / RTS style).
 */
const REP_TO_RPE_PCT: Record<number, Record<(typeof RPE_KEYS)[number], number>> = {
  1: { 6: 86, 6.5: 88, 7: 89, 7.5: 91, 8: 92, 8.5: 94, 9: 96, 9.5: 98, 10: 100 },
  2: { 6: 84, 6.5: 85, 7: 86, 7.5: 88, 8: 89, 8.5: 91, 9: 92, 9.5: 94, 10: 96 },
  3: { 6: 81, 6.5: 82, 7: 84, 7.5: 86, 8: 87, 8.5: 89, 9: 90, 9.5: 92, 10: 94 },
  4: { 6: 79, 6.5: 80, 7: 82, 7.5: 84, 8: 85, 8.5: 87, 9: 88, 9.5: 90, 10: 92 },
  5: { 6: 76, 6.5: 78, 7: 79, 7.5: 81, 8: 82, 8.5: 84, 9: 86, 9.5: 88, 10: 89 },
  6: { 6: 74, 6.5: 75, 7: 77, 7.5: 79, 8: 80, 8.5: 82, 9: 84, 9.5: 86, 10: 87 },
  7: { 6: 72, 6.5: 73, 7: 75, 7.5: 76, 8: 78, 8.5: 80, 9: 82, 9.5: 84, 10: 85 },
  8: { 6: 69, 6.5: 71, 7: 72, 7.5: 74, 8: 76, 8.5: 78, 9: 80, 9.5: 81, 10: 83 },
  9: { 6: 67, 6.5: 68, 7: 70, 7.5: 72, 8: 74, 8.5: 76, 9: 78, 9.5: 79, 10: 81 },
  10: { 6: 65, 6.5: 66, 7: 68, 7.5: 70, 8: 72, 8.5: 74, 9: 75, 9.5: 77, 10: 79 },
  11: { 6: 63, 6.5: 64, 7: 66, 7.5: 68, 8: 70, 8.5: 72, 9: 73, 9.5: 75, 10: 77 },
  12: { 6: 61, 6.5: 62, 7: 64, 7.5: 66, 8: 68, 8.5: 70, 9: 71, 9.5: 73, 10: 75 },
};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function roundToHalf(rpe: number) {
  return Math.round(rpe * 2) / 2;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function pctAt(rep: number, rpe: number): number {
  const rpeC = clamp(roundToHalf(rpe), 6, 10);
  const lowR = Math.floor(rep);
  const highR = Math.ceil(rep);
  const repLow = clamp(lowR < 1 ? 1 : lowR, 1, 12);
  const repHigh = clamp(highR > 12 ? 12 : highR, 1, 12);

  const rpeIdx = RPE_KEYS.indexOf(rpeC as (typeof RPE_KEYS)[number]);
  const rpeFrac =
    rpeC !== rpe
      ? (() => {
          const flo = Math.floor(rpe * 2) / 2;
          const cei = Math.ceil(rpe * 2) / 2;
          const fk = RPE_KEYS.indexOf(flo as (typeof RPE_KEYS)[number]);
          const ck = RPE_KEYS.indexOf(cei as (typeof RPE_KEYS)[number]);
          if (fk < 0 || ck < 0) return { i0: rpeIdx, i1: rpeIdx, t: 0 };
          const t = (rpe - flo) / (cei - flo || 1);
          return { i0: fk, i1: ck, t };
        })()
      : { i0: rpeIdx, i1: rpeIdx, t: 0 };

  const getCell = (reps: number, ki: number) => {
    const k = RPE_KEYS[clamp(ki, 0, RPE_KEYS.length - 1)];
    return REP_TO_RPE_PCT[reps]![k]!;
  };

  const p00 = getCell(repLow, rpeFrac.i0);
  const p01 = getCell(repHigh, rpeFrac.i0);
  const p10 = getCell(repLow, rpeFrac.i1);
  const p11 = getCell(repHigh, rpeFrac.i1);
  const pr0 = lerp(p00, p10, rpeFrac.t);
  const pr1 = lerp(p01, p11, rpeFrac.t);
  if (repLow === repHigh) return pr0;
  const rt = (rep - repLow) / (repHigh - repLow);
  return lerp(pr0, pr1, rt);
}

/** Brzycki estimated 1RM. Same unit as `weight`. */
export function brzyckiOneRm(weight: number, reps: number): number | null {
  if (!(weight > 0) || !Number.isFinite(weight)) return null;
  if (reps < 1 || !Number.isFinite(reps)) return null;
  if (reps === 1) return weight;
  const denom = 1.0278 - 0.0278 * reps;
  if (denom <= 0) return null;
  return weight / denom;
}

/** % of 1RM from target reps and RPE (6–10). */
export function rpeRepsToPct1rm(rpe: number, reps: number): number {
  return pctAt(reps, rpe);
}

/** Estimated 1RM from one logged set (same unit as `weight`). Uses RPE×reps % chart. */
export function estimateOneRmFromSet(
  weight: number,
  reps: number | null | undefined,
  rpe: number | null | undefined,
): number | null {
  if (!(weight > 0) || !Number.isFinite(weight)) return null;
  if (reps == null || !(reps >= 1) || !Number.isFinite(reps)) return null;
  if (rpe == null || !Number.isFinite(rpe)) return null;
  const pct = rpeRepsToPct1rm(rpe, reps);
  if (!(pct > 0)) return null;
  return weight / (pct / 100);
}

export function normalizeWeightToKg(weight: number, unit: WeightUnit): number {
  return unit === "LB" ? weight * KG_PER_LB : weight;
}

export function displayFromKg(kg: number, unit: WeightUnit): number {
  return unit === "LB" ? kg / KG_PER_LB : kg;
}

export function roundToIncrement(weight: number, increment: number): number {
  if (!(increment > 0)) return weight;
  return Math.round(weight / increment) * increment;
}

/** Smallest load ≥ `weight` on the plate ladder (progression bumps). */
export function roundWeightUpToIncrement(weight: number, increment: number): number {
  if (!(increment > 0)) return weight;
  return Math.ceil(weight / increment - 1e-9) * increment;
}

export function oneRmToWorkingWeight(
  oneRm: number,
  pctOf1rm: number,
  unit: WeightUnit,
  plateIncrement: number,
): number {
  const raw = (oneRm * pctOf1rm) / 100;
  return roundToIncrement(raw, plateIncrement);
}

export function estimateWeightFromTarget(
  e1rm: number,
  targetReps: number,
  targetRpe: number,
  unit: WeightUnit,
  plateIncrement: number,
): number | null {
  if (!(e1rm > 0)) return null;
  const pct = rpeRepsToPct1rm(targetRpe, targetReps);
  return oneRmToWorkingWeight(e1rm, pct, unit, plateIncrement);
}

export type ProgressionInput = {
  currentWeight: number;
  repGoal: number;
  actualReps: number;
  prescribedRpe: number;
  actualRpe: number | null;
  /** Smallest load step for suggested next-week weight (lb or kg matching display unit). */
  plateIncrement?: number;
};

/** If rep goal met at target RPE (within tolerance), suggest small % bump rounded to bar step; else hold. */
export function suggestNextWeekLoad(input: ProgressionInput): {
  suggested: number;
  bumped: boolean;
  bumpPct: number;
  bumpBy: number;
} {
  const { currentWeight, repGoal, actualReps, prescribedRpe, actualRpe, plateIncrement } = input;
  if (!(currentWeight > 0)) return { suggested: currentWeight, bumped: false, bumpPct: 0, bumpBy: 0 };
  if (actualRpe != null && actualRpe > 9) {
    return { suggested: currentWeight, bumped: false, bumpPct: 0, bumpBy: 0 };
  }
  const rpeOk =
    actualRpe == null ? actualReps >= repGoal : actualReps >= repGoal && actualRpe <= prescribedRpe + 0.5;
  if (!rpeOk) return { suggested: currentWeight, bumped: false, bumpPct: 0, bumpBy: 0 };
  const inc = plateIncrement != null && plateIncrement > 0 ? plateIncrement : 2.5;
  const suggested = roundWeightUpToIncrement(currentWeight + inc, inc);
  const bumpBy = Math.max(0, suggested - currentWeight);
  const bumpPct = currentWeight > 0 ? bumpBy / currentWeight : 0;
  return {
    suggested,
    bumped: true,
    bumpPct,
    bumpBy,
  };
}

/** Readiness 0–10 sliders: sleep (higher better), stress & soreness (higher worse). Clamped multiplier. */
export function readinessToIntensityScalar(
  sleep: number,
  stress: number,
  soreness: number,
): number {
  const clamp10 = (n: number) => clamp(n, 0, 10);
  const s = clamp10(sleep);
  const t = clamp10(stress);
  const r = clamp10(soreness);
  const sleepN = s / 10;
  const stressN = (10 - t) / 10;
  const soreN = (10 - r) / 10;
  const MIN_M = 0.8;
  const MAX_M = 1.1;
  const composite = (sleepN + stressN + soreN) / 3;
  return MIN_M + composite * (MAX_M - MIN_M);
}
