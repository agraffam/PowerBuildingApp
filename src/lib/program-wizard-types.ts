export type WizardBlock = { blockType: string; startWeek: number; endWeek: number };

export type WizardExercise = {
  exerciseSlug: string;
  sets: number;
  repTarget: number;
  targetRpe: number;
  pctOf1rm?: number | null;
  restSec?: number | null;
  /** null = use exercise library default; true/false overrides bodyweight for this slot. */
  useBodyweight?: boolean | null;
  /** Same label on consecutive exercises = superset (e.g. A, B). */
  supersetGroup?: string | null;
  notes?: string | null;
  /** Cardio: target seconds per set/bout. */
  targetDurationSec?: number | null;
  targetCalories?: number | null;
  /** Set when loading an existing program for incremental PATCH saves. */
  programExerciseId?: string;
};

export type WizardDay = {
  label: string;
  exercises: WizardExercise[];
  programDayId?: string;
};

export type ProgramWizardPayload = {
  name: string;
  durationWeeks: number;
  /** null = deload off; 4–6 = every N weeks. */
  deloadIntervalWeeks?: number | null;
  /** Default true for new programs. */
  autoBlockPrescriptions?: boolean;
  blocks: WizardBlock[];
  days: WizardDay[];
};
