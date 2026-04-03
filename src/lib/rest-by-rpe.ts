/** RPE keys aligned with rest timer and %1RM chart (6–10, 0.5 steps). */
export const RPE_REST_KEYS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;

export type RpeRestKey = (typeof RPE_REST_KEYS)[number];

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function roundToHalf(rpe: number) {
  return Math.round(rpe * 2) / 2;
}

/** Default rest seconds at each RPE step from baseline `defaultRestSec` (usually RPE 8). */
export function buildDefaultRestDurationsByRpe(defaultRestSec: number): Record<string, number> {
  const base = Math.max(30, Math.round(defaultRestSec));
  const out: Record<string, number> = {};
  for (const rpe of RPE_REST_KEYS) {
    const t = (rpe - 6) / 4;
    const factor = 1.42 - t * 0.72;
    out[String(rpe)] = Math.max(30, Math.round(base * factor));
  }
  return out;
}

export function parseRestDurationsOverrides(raw: unknown): Partial<Record<string, number>> {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: Partial<Record<string, number>> = {};
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v) && v > 0 && v < 3600) {
      out[k] = Math.round(v);
    }
  }
  return out;
}

/** Merged map: override wins when present for that key. */
export function mergeRestDurationsByRpe(
  storedJson: unknown,
  defaultRestSec: number,
): Record<string, number> {
  const defaults = buildDefaultRestDurationsByRpe(defaultRestSec);
  const overrides = parseRestDurationsOverrides(storedJson);
  const merged = { ...defaults };
  for (const key of RPE_REST_KEYS) {
    const sk = String(key);
    if (overrides[sk] != null) merged[sk] = overrides[sk]!;
  }
  return merged;
}

/** From a full merged map, persist only keys that differ from current defaults. */
export function overridesFromMerged(
  merged: Record<string, number>,
  defaultRestSec: number,
): Record<string, number> | null {
  const defaults = buildDefaultRestDurationsByRpe(defaultRestSec);
  const diff: Record<string, number> = {};
  for (const key of RPE_REST_KEYS) {
    const sk = String(key);
    const m = merged[sk];
    if (m == null || !Number.isFinite(m)) continue;
    const d = defaults[sk];
    if (Math.round(m) !== d) diff[sk] = Math.max(30, Math.min(3600, Math.round(m)));
  }
  return Object.keys(diff).length > 0 ? diff : null;
}

export function validateMergedRestMap(input: unknown): Record<string, number> | null {
  if (input == null || typeof input !== "object" || Array.isArray(input)) return null;
  const o = input as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const key of RPE_REST_KEYS) {
    const sk = String(key);
    const v = o[sk];
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    const n = Math.round(v);
    if (n < 15 || n > 3600) return null;
    out[sk] = n;
  }
  return out;
}

/** RPE clamped to chart range and half-step; returns rest seconds from merged map. */
export function restSecForRpe(
  mergedMap: Record<string, number>,
  rpe: number,
  defaultRestSec: number,
): number {
  const r = clamp(roundToHalf(rpe), 6, 10);
  const key = String(r);
  const v = mergedMap[key];
  if (v != null && v > 0) return v;
  return Math.max(30, Math.round(defaultRestSec));
}
