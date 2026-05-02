import { z } from "zod";
import type { ProgramWizardPayload, WizardDay, WizardExercise } from "@/lib/program-wizard-types";
import {
  validateDeloadIntervalWeeks,
  validateMesocycleBlocks,
  validatePeakingBlockOrder,
} from "@/lib/program-periodization";
import { validateSupersetSets } from "@/lib/program-superset-validation";

const BLOCK_TYPES = ["HYPERTROPHY", "STRENGTH", "PEAKING"] as const;

const wizardExerciseSchema = z.object({
  exerciseSlug: z.string().min(1, "Each exercise needs a slug."),
  sets: z.number().int().min(1).max(99),
  repTarget: z.number().nullable().optional(),
  targetRpe: z.number().nullable().optional(),
  pctOf1rm: z.number().min(0).max(100).nullable().optional(),
  restSec: z.number().nullable().optional(),
  useBodyweight: z.boolean().nullable().optional(),
  supersetGroup: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  targetDurationSec: z.number().nullable().optional(),
  targetCalories: z.number().nullable().optional(),
  programExerciseId: z.string().optional(),
});

const wizardDaySchema = z.object({
  label: z.string().min(1, "Each training day needs a label."),
  exercises: z.array(wizardExerciseSchema).min(1, "Each day needs at least one exercise."),
  programDayId: z.string().optional(),
});

const wizardBlockSchema = z.object({
  blockType: z.enum(BLOCK_TYPES),
  startWeek: z.number(),
  endWeek: z.number(),
});

/** Structural parse only — run {@link validateProgramWizardBusinessRules} before trusting payload. */
export const programWizardPayloadSchema = z.object({
  name: z.string(),
  durationWeeks: z.number(),
  deloadIntervalWeeks: z.number().nullable().optional(),
  autoBlockPrescriptions: z.boolean().optional(),
  periodizationStyle: z.enum(["LINEAR", "ALTERNATING", "UNDULATING"]).optional(),
  blocks: z.array(wizardBlockSchema).min(1, "At least one mesocycle block is required."),
  days: z.array(wizardDaySchema).min(1, "At least one training day is required."),
});

export type ParsedWizardPayload = z.infer<typeof programWizardPayloadSchema>;

function stripIdsForCreate(exercises: ParsedWizardPayload["days"][number]["exercises"]): WizardExercise[] {
  return exercises.map(
    ({
      exerciseSlug,
      sets,
      repTarget,
      targetRpe,
      pctOf1rm,
      restSec,
      useBodyweight,
      supersetGroup,
      notes,
      targetDurationSec,
      targetCalories,
    }) => ({
      exerciseSlug,
      sets,
      repTarget,
      targetRpe,
      pctOf1rm,
      restSec,
      useBodyweight,
      supersetGroup,
      notes,
      targetDurationSec,
      targetCalories,
    }),
  );
}

/** Normalize parsed JSON into {@link ProgramWizardPayload} suitable for create / builder `initial`. */
export function normalizeParsedWizardPayload(parsed: ParsedWizardPayload): ProgramWizardPayload {
  const days: WizardDay[] = parsed.days.map((d) => ({
    label: d.label.trim(),
    exercises: stripIdsForCreate(d.exercises),
  }));

  return {
    name: parsed.name.trim(),
    durationWeeks: parsed.durationWeeks,
    deloadIntervalWeeks:
      parsed.deloadIntervalWeeks === undefined ? undefined : parsed.deloadIntervalWeeks,
    autoBlockPrescriptions: parsed.autoBlockPrescriptions !== false,
    periodizationStyle: parsed.periodizationStyle ?? "LINEAR",
    blocks: parsed.blocks.map((b) => ({
      blockType: b.blockType,
      startWeek: b.startWeek,
      endWeek: b.endWeek,
    })),
    days,
  };
}

/** Same rules as `POST /api/programs` before persistence (blocks, deload, supersets). */
export function validateProgramWizardBusinessRules(
  payload: ProgramWizardPayload,
): { ok: true } | { ok: false; error: string } {
  if (!payload.name.trim()) {
    return { ok: false, error: "Program name is required." };
  }

  const period = validateMesocycleBlocks(payload.durationWeeks, payload.blocks ?? []);
  if (!period.ok) return period;

  const peakOrd = validatePeakingBlockOrder(
    (payload.blocks ?? []).map((b) => ({ ...b, blockType: String(b.blockType) })),
  );
  if (!peakOrd.ok) return peakOrd;

  const delVal = validateDeloadIntervalWeeks(
    payload.deloadIntervalWeeks === undefined ? 5 : payload.deloadIntervalWeeks,
  );
  if (!delVal.ok) return delVal;

  const sup = validateSupersetSets(payload.days);
  if (!sup.ok) return sup;

  return { ok: true };
}

function formatZodError(err: z.ZodError): string {
  const first = err.issues[0];
  if (!first) return "Invalid program payload.";
  const path = first.path.length ? `${first.path.join(".")}: ` : "";
  return `${path}${first.message}`;
}

/**
 * Parse pasted JSON text into a validated {@link ProgramWizardPayload}.
 * Matches server-side checks used when creating a program (structure + periodization + supersets).
 */
export function parseProgramWizardJson(text: string): { ok: true; data: ProgramWizardPayload } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: "Invalid JSON." };
  }

  const parsed = programWizardPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: formatZodError(parsed.error) };
  }

  const normalized = normalizeParsedWizardPayload(parsed.data);
  const biz = validateProgramWizardBusinessRules(normalized);
  if (!biz.ok) return biz;

  return { ok: true, data: normalized };
}
