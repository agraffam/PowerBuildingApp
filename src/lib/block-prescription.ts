import { BlockType, ExerciseKind, type PrescriptionLoadRole } from "@prisma/client";
import {
  DELOAD_CARDIO_BOUT_FACTOR,
  DELOAD_CARDIO_DURATION_FACTOR,
  DELOAD_CARDIO_KCAL_FACTOR,
  DELOAD_PCT_MIN,
  DELOAD_PCT_SUBTRACT,
  DELOAD_REP_BUMP,
  DELOAD_RPE_DELTA,
  DELOAD_RPE_MIN,
  DELOAD_SET_FACTOR,
  PEAK_ACCESSORY_REP_FACTOR,
  PEAK_ACCESSORY_REP_MIN,
  PEAK_COMPOUND_PCT_ADD,
  PEAK_COMPOUND_REP_FACTOR,
  PEAK_COMPOUND_REP_MAX,
  PEAK_COMPOUND_REP_MIN,
  PEAK_COMPOUND_RPE_ADD,
  PEAK_COMPOUND_SET_SUB,
  PEAK_ISOLATION_SET_FACTOR,
  STRENGTH_ACCESSORY_REP_FACTOR,
  STRENGTH_ACCESSORY_REP_MIN,
  STRENGTH_COMPOUND_PCT_ADD,
  STRENGTH_COMPOUND_REP_FACTOR,
  STRENGTH_COMPOUND_REP_MAX,
  STRENGTH_COMPOUND_REP_MIN,
  STRENGTH_COMPOUND_RPE_ADD,
  STRENGTH_ISOLATION_REP_FACTOR,
  STRENGTH_ISOLATION_REP_MIN,
} from "@/lib/block-prescription-templates";

export function calendarWeekFromInstanceWeekIndex(weekIndex: number): number {
  return weekIndex + 1;
}

export function resolveBlockTypeForCalendarWeek(
  blocks: { blockType: BlockType; startWeek: number; endWeek: number }[],
  calendarWeek: number,
): BlockType | null {
  for (const b of blocks) {
    if (calendarWeek >= b.startWeek && calendarWeek <= b.endWeek) return b.blockType;
  }
  return null;
}

export function isDeloadCalendarWeek(
  deloadIntervalWeeks: number | null | undefined,
  calendarWeek: number,
): boolean {
  if (deloadIntervalWeeks == null) return false;
  if (deloadIntervalWeeks < 4 || deloadIntervalWeeks > 6) return false;
  if (calendarWeek <= 0) return false;
  return calendarWeek % deloadIntervalWeeks === 0;
}

/** Derive role when DB field is null. */
export function inferPrescriptionLoadRole(
  exerciseKind: ExerciseKind,
  repTarget: number | null | undefined,
  explicit: PrescriptionLoadRole | null | undefined,
): PrescriptionLoadRole {
  if (explicit) return explicit;
  if (exerciseKind === "CARDIO") return "CARDIO";
  const r = repTarget ?? 8;
  if (r <= 6) return "COMPOUND";
  if (r >= 12) return "ISOLATION";
  return "ACCESSORY";
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function roundHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

export type ProgramExercisePrescriptionInput = {
  sets: number;
  repTarget: number | null;
  targetRpe: number | null;
  pctOf1rm: number | null;
  restSec: number | null;
  targetDurationSec: number | null;
  targetCalories: number | null;
  loadRole: PrescriptionLoadRole | null;
};

export type ResolvedPrescription = {
  sets: number;
  repTarget: number;
  targetRpe: number;
  pctOf1rm: number | null;
  restSec: number | null;
  targetDurationSec: number | null;
  targetCalories: number | null;
  blockType: BlockType | null;
  isDeloadWeek: boolean;
};

export type PeriodizationStyle = "LINEAR" | "ALTERNATING" | "UNDULATING";

type VolumeLandmarks = { mev: number; mrv: number };

const VOLUME_LANDMARKS: Record<PrescriptionLoadRole, Record<BlockType, VolumeLandmarks>> = {
  COMPOUND: {
    HYPERTROPHY: { mev: 8, mrv: 16 },
    STRENGTH: { mev: 6, mrv: 12 },
    PEAKING: { mev: 4, mrv: 8 },
  },
  ACCESSORY: {
    HYPERTROPHY: { mev: 10, mrv: 20 },
    STRENGTH: { mev: 8, mrv: 14 },
    PEAKING: { mev: 6, mrv: 10 },
  },
  ISOLATION: {
    HYPERTROPHY: { mev: 12, mrv: 22 },
    STRENGTH: { mev: 8, mrv: 16 },
    PEAKING: { mev: 6, mrv: 12 },
  },
  CARDIO: {
    HYPERTROPHY: { mev: 1, mrv: 6 },
    STRENGTH: { mev: 1, mrv: 5 },
    PEAKING: { mev: 1, mrv: 4 },
  },
};

function getWeekIndexWithinBlock(
  blocks: { blockType: BlockType; startWeek: number; endWeek: number }[],
  calendarWeek: number,
): { index: number; length: number } | null {
  const b = blocks.find((x) => calendarWeek >= x.startWeek && calendarWeek <= x.endWeek);
  if (!b) return null;
  return { index: calendarWeek - b.startWeek, length: b.endWeek - b.startWeek + 1 };
}

function normalizedVolumeFactor(style: PeriodizationStyle, weekInBlock: number, blockLength: number): number {
  if (blockLength <= 1) return 0.75;
  const linear = weekInBlock / (blockLength - 1);
  if (style === "LINEAR") return linear;
  if (style === "ALTERNATING") {
    const base = 0.45 + linear * 0.35;
    return weekInBlock % 2 === 0 ? Math.max(0.25, base - 0.2) : Math.min(1, base + 0.2);
  }
  // UNDULATING: low/medium/high wave with mild upward trend across block.
  const wave = [0.2, 0.55, 0.9, 0.55];
  const cyc = wave[weekInBlock % wave.length] ?? 0.55;
  return clamp(cyc * 0.8 + linear * 0.2, 0.1, 1);
}

function setsFromMrvMev(params: {
  baseSets: number;
  role: PrescriptionLoadRole;
  blockType: BlockType;
  style: PeriodizationStyle;
  weekInBlock: number;
  blockLength: number;
}): number {
  const lm = VOLUME_LANDMARKS[params.role][params.blockType];
  const factor = normalizedVolumeFactor(params.style, params.weekInBlock, params.blockLength);
  const targetWeeklySets = lm.mev + (lm.mrv - lm.mev) * factor;
  // Map per-exercise base sets onto a similar relative intensity band from MEV->MRV.
  const baseRelative = clamp((params.baseSets - 2) / 4, 0, 1);
  const scaledRelative = clamp((baseRelative + factor) / 2, 0, 1);
  const scaled = lm.mev + (lm.mrv - lm.mev) * scaledRelative;
  const blended = Math.round((scaled + targetWeeklySets) / 2);
  return Math.max(1, blended);
}

function defaultStyleForBlock(blockType: BlockType | null): PeriodizationStyle {
  if (blockType === "STRENGTH") return "ALTERNATING";
  if (blockType === "PEAKING") return "UNDULATING";
  return "LINEAR";
}

function applyMesoStrength(
  role: PrescriptionLoadRole,
  block: BlockType,
  rep: number,
  rpe: number,
  pct: number | null,
  sets: number,
): { rep: number; rpe: number; pct: number | null; sets: number } {
  const out = { rep, rpe, pct, sets };
  if (block === "HYPERTROPHY") return out;

  if (block === "STRENGTH") {
    if (role === "COMPOUND") {
      out.rep = clamp(Math.round(rep * STRENGTH_COMPOUND_REP_FACTOR), STRENGTH_COMPOUND_REP_MIN, STRENGTH_COMPOUND_REP_MAX);
      out.rpe = roundHalf(clamp(rpe + STRENGTH_COMPOUND_RPE_ADD, 6, 9.5));
      out.pct = pct != null ? clamp(pct + STRENGTH_COMPOUND_PCT_ADD, 50, 95) : null;
    } else if (role === "ACCESSORY") {
      out.rep = clamp(Math.round(rep * STRENGTH_ACCESSORY_REP_FACTOR), STRENGTH_ACCESSORY_REP_MIN, 30);
      out.rpe = roundHalf(clamp(rpe + 0.25, 6, 9.5));
    } else if (role === "ISOLATION") {
      out.rep = clamp(Math.round(rep * STRENGTH_ISOLATION_REP_FACTOR), STRENGTH_ISOLATION_REP_MIN, 30);
      out.rpe = roundHalf(clamp(rpe + 0.25, 6, 10));
    }
    return out;
  }

  if (block === "PEAKING") {
    if (role === "COMPOUND") {
      out.rep = clamp(Math.round(rep * PEAK_COMPOUND_REP_FACTOR), PEAK_COMPOUND_REP_MIN, PEAK_COMPOUND_REP_MAX);
      out.rpe = roundHalf(clamp(rpe + PEAK_COMPOUND_RPE_ADD, 6, 10));
      out.pct = pct != null ? clamp(pct + PEAK_COMPOUND_PCT_ADD, 55, 100) : null;
      out.sets = Math.max(1, sets - PEAK_COMPOUND_SET_SUB);
    } else if (role === "ACCESSORY") {
      out.rep = clamp(Math.round(rep * PEAK_ACCESSORY_REP_FACTOR), PEAK_ACCESSORY_REP_MIN, 24);
      out.sets = Math.max(2, Math.round(sets * 0.85));
    } else if (role === "ISOLATION") {
      out.sets = Math.max(1, Math.round(sets * PEAK_ISOLATION_SET_FACTOR));
    }
  }
  return out;
}

function applyDeloadStrength(
  role: PrescriptionLoadRole,
  rep: number,
  rpe: number,
  pct: number | null,
  sets: number,
): { rep: number; rpe: number; pct: number | null; sets: number } {
  let s = Math.max(1, Math.round(sets * DELOAD_SET_FACTOR));
  const rp = rep + DELOAD_REP_BUMP;
  const rr = roundHalf(clamp(rpe + DELOAD_RPE_DELTA, DELOAD_RPE_MIN, 10));
  const pc = pct != null ? clamp(pct - DELOAD_PCT_SUBTRACT, DELOAD_PCT_MIN, 95) : null;
  if (role === "ISOLATION") {
    s = Math.max(1, Math.round(s * 0.9));
  }
  return { rep: rp, rpe: rr, pct: pc, sets: s };
}

function applyDeloadCardio(
  sets: number,
  duration: number | null,
  kcal: number | null,
): { sets: number; duration: number | null; kcal: number | null } {
  const s = Math.max(1, Math.round(sets * DELOAD_CARDIO_BOUT_FACTOR));
  const d =
    duration != null && duration > 0
      ? Math.max(30, Math.round(duration * DELOAD_CARDIO_DURATION_FACTOR))
      : null;
  const k =
    kcal != null && kcal > 0 ? Math.max(10, Math.round(kcal * DELOAD_CARDIO_KCAL_FACTOR)) : null;
  return { sets: s, duration: d, kcal: k };
}

export function resolveProgramExercisePrescription(params: {
  programExercise: ProgramExercisePrescriptionInput;
  exerciseKind: ExerciseKind;
  autoBlockPrescriptions: boolean;
  deloadIntervalWeeks: number | null | undefined;
  blocks: { blockType: BlockType; startWeek: number; endWeek: number }[];
  instanceWeekIndex: number;
  periodizationStyle?: PeriodizationStyle;
}): ResolvedPrescription {
  const pe = params.programExercise;
  const calendarWeek = calendarWeekFromInstanceWeekIndex(params.instanceWeekIndex);
  const blockType = resolveBlockTypeForCalendarWeek(params.blocks, calendarWeek);
  const deload = isDeloadCalendarWeek(params.deloadIntervalWeeks, calendarWeek);
  const role = inferPrescriptionLoadRole(params.exerciseKind, pe.repTarget, pe.loadRole);

  const baseRep = pe.repTarget ?? (params.exerciseKind === "CARDIO" ? 1 : 8);
  const baseRpe = pe.targetRpe ?? (params.exerciseKind === "CARDIO" ? 6 : 8);

  if (params.exerciseKind === "CARDIO" || role === "CARDIO") {
    let sets = pe.sets;
    let duration = pe.targetDurationSec;
    let kcal = pe.targetCalories;
    if (params.autoBlockPrescriptions && deload) {
      const c = applyDeloadCardio(sets, duration, kcal);
      sets = c.sets;
      duration = c.duration;
      kcal = c.kcal;
    }
    return {
      sets,
      repTarget: baseRep,
      targetRpe: baseRpe,
      pctOf1rm: null,
      restSec: pe.restSec,
      targetDurationSec: duration,
      targetCalories: kcal,
      blockType,
      isDeloadWeek: deload,
    };
  }

  if (!params.autoBlockPrescriptions) {
    return {
      sets: pe.sets,
      repTarget: baseRep,
      targetRpe: baseRpe,
      pctOf1rm: pe.pctOf1rm,
      restSec: pe.restSec,
      targetDurationSec: pe.targetDurationSec,
      targetCalories: pe.targetCalories,
      blockType,
      isDeloadWeek: deload,
    };
  }

  if (blockType == null) {
    return {
      sets: pe.sets,
      repTarget: baseRep,
      targetRpe: baseRpe,
      pctOf1rm: pe.pctOf1rm,
      restSec: pe.restSec,
      targetDurationSec: pe.targetDurationSec,
      targetCalories: pe.targetCalories,
      blockType: null,
      isDeloadWeek: deload,
    };
  }

  let rep = baseRep;
  let rpe = baseRpe;
  let pct = pe.pctOf1rm;
  let sets = pe.sets;
  const periodizationStyle = params.periodizationStyle ?? defaultStyleForBlock(blockType);

  const meso = applyMesoStrength(role, blockType, rep, rpe, pct, sets);
  rep = meso.rep;
  rpe = meso.rpe;
  pct = meso.pct;
  sets = meso.sets;

  const blockPos = getWeekIndexWithinBlock(params.blocks, calendarWeek);
  if (blockPos) {
    sets = setsFromMrvMev({
      baseSets: sets,
      role,
      blockType,
      style: periodizationStyle,
      weekInBlock: blockPos.index,
      blockLength: blockPos.length,
    });
    const fatigueBias = normalizedVolumeFactor(periodizationStyle, blockPos.index, blockPos.length);
    rpe = roundHalf(clamp(rpe + (fatigueBias - 0.5) * 0.5, 6, 10));
    if (pct != null) {
      pct = clamp(pct + (fatigueBias - 0.5) * 4, 50, 100);
    }
  }

  if (deload) {
    const d = applyDeloadStrength(role, rep, rpe, pct, sets);
    rep = d.rep;
    rpe = d.rpe;
    pct = d.pct;
    sets = d.sets;
  }

  return {
    sets,
    repTarget: rep,
    targetRpe: rpe,
    pctOf1rm: pct,
    restSec: pe.restSec,
    targetDurationSec: pe.targetDurationSec,
    targetCalories: pe.targetCalories,
    blockType,
    isDeloadWeek: deload,
  };
}
