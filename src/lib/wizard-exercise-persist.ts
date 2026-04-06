import type { ExerciseKind } from "@prisma/client";

/** Normalize wizard/API rep + RPE for DB: cardio may be null; strength defaults to sensible values. */
export function persistRepTargetRpe(
  kind: ExerciseKind,
  repTarget: number | null | undefined,
  targetRpe: number | null | undefined,
): { repTarget: number | null; targetRpe: number | null } {
  if (kind === "CARDIO") {
    return {
      repTarget:
        repTarget == null || !Number.isFinite(repTarget) ? null : Math.round(repTarget),
      targetRpe:
        targetRpe == null || !Number.isFinite(targetRpe) ? null : targetRpe,
    };
  }
  const r =
    repTarget == null || !Number.isFinite(repTarget)
      ? 8
      : Math.round(Math.max(1, Math.min(999, repTarget)));
  const rpeRaw = targetRpe == null || !Number.isFinite(targetRpe) ? 8 : targetRpe;
  const rpe = Math.max(6, Math.min(10, rpeRaw));
  return { repTarget: r, targetRpe: rpe };
}
