export type WizardBlock = { blockType: string; startWeek: number; endWeek: number };

export type WizardExercise = {
  exerciseSlug: string;
  sets: number;
  repTarget: number;
  targetRpe: number;
  pctOf1rm?: number | null;
  restSec?: number | null;
  /** Same label on consecutive exercises = superset (e.g. A, B). */
  supersetGroup?: string | null;
};

export type WizardDay = { label: string; exercises: WizardExercise[] };

export type ProgramWizardPayload = {
  name: string;
  durationWeeks: number;
  blocks: WizardBlock[];
  days: WizardDay[];
};
