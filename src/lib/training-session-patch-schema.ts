import { z } from "zod";
import { isLoggedRpeStep } from "@/lib/rest-by-rpe";

const readiness = z.object({
  action: z.literal("readiness"),
  sleep: z.number().finite().min(0).max(10),
  stress: z.number().finite().min(0).max(10),
  soreness: z.number().finite().min(0).max(10),
});

const setBody = z
  .object({
    action: z.literal("set"),
    setId: z.string().min(1),
    weight: z.number().finite().optional(),
    weightUnit: z.enum(["KG", "LB"]).optional(),
    reps: z.number().finite().nullable().optional(),
    rpe: z.number().finite().nullable().optional(),
    durationSec: z.number().int().min(0).max(86400).nullable().optional(),
    calories: z.number().int().min(0).max(50000).nullable().optional(),
    done: z.boolean().optional(),
    propagateWeight: z.boolean().optional(),
    notes: z.union([z.string().max(500), z.null()]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.rpe !== undefined && data.rpe !== null && !isLoggedRpeStep(data.rpe)) {
      ctx.addIssue({
        code: "custom",
        message: "RPE must be between 6 and 10 in 0.5 steps",
        path: ["rpe"],
      });
    }
  });

export const trainingSessionPatchBodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("complete") }),
  readiness,
  setBody,
  z.object({
    action: z.literal("swapExercise"),
    programExerciseId: z.string().min(1),
    replacementExerciseId: z.string().min(1),
    scope: z.enum(["session", "program"]),
  }),
  z.object({
    action: z.literal("setBodyweight"),
    programExerciseId: z.string().min(1),
    useBodyweight: z.boolean(),
    scope: z.enum(["session", "program"]),
  }),
  z.object({
    action: z.literal("reorderExercises"),
    orderedProgramExerciseIds: z.array(z.string().min(1)),
  }),
  z.object({
    action: z.literal("updateMetadata"),
    performedAt: z.string().min(1),
  }),
]);

export type TrainingSessionPatchBody = z.infer<typeof trainingSessionPatchBodySchema>;
