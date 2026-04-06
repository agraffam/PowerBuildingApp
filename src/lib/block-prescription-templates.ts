/**
 * Tunable knobs for mesocycle + deload scaling (general periodization conventions;
 * not medical advice). See product plan and public guides on accumulation vs intensification.
 */

/** Fewer working sets on deload weeks. */
export const DELOAD_SET_FACTOR = 0.55;
/** Ease bar speed / RPE. */
export const DELOAD_RPE_DELTA = -1.5;
/** Slightly more reps at lighter loads on deload (submax). */
export const DELOAD_REP_BUMP = 1;
/** Ease %1RM prescription. */
export const DELOAD_PCT_SUBTRACT = 12;
export const DELOAD_PCT_MIN = 55;
export const DELOAD_RPE_MIN = 6;
/** Cardio: back off time and kcal slightly on deload. */
export const DELOAD_CARDIO_DURATION_FACTOR = 0.88;
export const DELOAD_CARDIO_KCAL_FACTOR = 0.88;
export const DELOAD_CARDIO_BOUT_FACTOR = 0.5;

/** Strength block: compound rep multiplier vs hypertrophy baseline. */
export const STRENGTH_COMPOUND_REP_FACTOR = 0.72;
export const STRENGTH_COMPOUND_REP_MIN = 3;
export const STRENGTH_COMPOUND_REP_MAX = 6;
export const STRENGTH_COMPOUND_RPE_ADD = 0.5;
export const STRENGTH_COMPOUND_PCT_ADD = 7;

export const STRENGTH_ACCESSORY_REP_FACTOR = 0.88;
export const STRENGTH_ACCESSORY_REP_MIN = 6;
export const STRENGTH_ISOLATION_REP_FACTOR = 0.92;
export const STRENGTH_ISOLATION_REP_MIN = 8;

/** Peaking: fewer reps, touch higher RPE on compounds. */
export const PEAK_COMPOUND_REP_FACTOR = 0.45;
export const PEAK_COMPOUND_REP_MIN = 1;
export const PEAK_COMPOUND_REP_MAX = 3;
export const PEAK_COMPOUND_RPE_ADD = 1;
export const PEAK_COMPOUND_PCT_ADD = 12;
export const PEAK_COMPOUND_SET_SUB = 1;

/** Accessories in peak: maintain or trim volume slightly. */
export const PEAK_ACCESSORY_REP_FACTOR = 0.94;
export const PEAK_ACCESSORY_REP_MIN = 6;
export const PEAK_ISOLATION_SET_FACTOR = 0.65;
