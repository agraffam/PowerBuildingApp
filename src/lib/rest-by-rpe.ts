/** RPE keys aligned with rest timer and %1RM chart (6–10, 0.5 steps). */
export const RPE_REST_KEYS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;

export type RpeRestKey = (typeof RPE_REST_KEYS)[number];

/** Allowed rest lengths in the RPE grid (seconds). */
export const RPE_REST_SEC_OPTIONS = [30, 60, 90, 120, 150, 180, 210] as const;

export type RpeRestSecOption = (typeof RPE_REST_SEC_OPTIONS)[number];

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function roundToHalf(rpe: number) {
  return Math.round(rpe * 2) / 2;
}

export function snapRestSecToOption(sec: number): RpeRestSecOption {
  const n = Math.round(sec);
  if (!Number.isFinite(n)) return 60;
  let best: RpeRestSecOption = RPE_REST_SEC_OPTIONS[0];
  let bestAbs = Infinity;
  for (const o of RPE_REST_SEC_OPTIONS) {
    const d = Math.abs(o - n);
    if (d < bestAbs) {
      bestAbs = d;
      best = o;
    }
  }
  return best;
}

const ALLOWED_REST_SEC = new Set<number>(RPE_REST_SEC_OPTIONS);

/** Built-in defaults: RPE 6–6.5 → 60s, 7–7.5 → 120s, 8+ → 180s. */
export function defaultRestDurationsByRpe(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const rpe of RPE_REST_KEYS) {
    if (rpe <= 6.5) out[String(rpe)] = 60;
    else if (rpe <= 7.5) out[String(rpe)] = 120;
    else out[String(rpe)] = 180;
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
      out[k] = snapRestSecToOption(v);
    }
  }
  return out;
}

/** Merged map: override wins when present for that key. */
export function mergeRestDurationsByRpe(storedJson: unknown): Record<string, number> {
  const defaults = defaultRestDurationsByRpe();
  const overrides = parseRestDurationsOverrides(storedJson);
  const merged = { ...defaults };
  for (const key of RPE_REST_KEYS) {
    const sk = String(key);
    if (overrides[sk] != null) merged[sk] = overrides[sk]!;
  }
  return merged;
}

/** From a full merged map, persist only keys that differ from built-in defaults. */
export function overridesFromMerged(merged: Record<string, number>): Record<string, number> | null {
  const defaults = defaultRestDurationsByRpe();
  const diff: Record<string, number> = {};
  for (const key of RPE_REST_KEYS) {
    const sk = String(key);
    const m = merged[sk];
    if (m == null || !Number.isFinite(m)) continue;
    const snapped = snapRestSecToOption(m);
    const d = defaults[sk];
    if (snapped !== d) diff[sk] = snapped;
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
    if (!ALLOWED_REST_SEC.has(n)) return null;
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
  return snapRestSecToOption(defaultRestSec);
}

/** UI / save grouping: 6–6.5, 7–7.5, 8–8.5, 9+. */
export const RPE_REST_BAND_IDS = ["6", "7", "8", "9"] as const;

export type RpeRestBandId = (typeof RPE_REST_BAND_IDS)[number];

export const RPE_BAND_LABELS: Record<RpeRestBandId, string> = {
  "6": "RPE 6–6.5",
  "7": "RPE 7–7.5",
  "8": "RPE 8–8.5",
  "9": "RPE 9+",
};

const BAND_KEYS: Record<RpeRestBandId, readonly RpeRestKey[]> = {
  "6": [6, 6.5],
  "7": [7, 7.5],
  "8": [8, 8.5],
  "9": [9, 9.5, 10],
};

export function rpeKeysForBand(band: RpeRestBandId): readonly RpeRestKey[] {
  return BAND_KEYS[band];
}

/** Map logged/target RPE to a band id (clamped 6–10, half steps). */
export function rpeToBandId(rpe: number): RpeRestBandId {
  const r = clamp(roundToHalf(rpe), 6, 10);
  if (r <= 6.5) return "6";
  if (r <= 7.5) return "7";
  if (r <= 8.5) return "8";
  return "9";
}

export function applyBandRestSec(
  draft: Record<string, number>,
  band: RpeRestBandId,
  sec: number,
): Record<string, number> {
  const next = { ...draft };
  const snapped = snapRestSecToOption(sec);
  for (const k of rpeKeysForBand(band)) {
    next[String(k)] = snapped;
  }
  return next;
}

/** One value per band (first key in band) for settings UI. */
export function bandDraftFromMerged(merged: Record<string, number>): Record<RpeRestBandId, number> {
  const out = {} as Record<RpeRestBandId, number>;
  for (const band of RPE_REST_BAND_IDS) {
    const keys = rpeKeysForBand(band);
    const sk = String(keys[0]!);
    out[band] = merged[sk] ?? defaultRestDurationsByRpe()[sk]!;
  }
  return out;
}

export function bandMapsEqual(
  a: Record<RpeRestBandId, number>,
  b: Record<RpeRestBandId, number>,
): boolean {
  for (const band of RPE_REST_BAND_IDS) {
    if ((a[band] ?? 0) !== (b[band] ?? 0)) return false;
  }
  return true;
}

export function rpeMapsEqual(a: Record<string, number>, b: Record<string, number>): boolean {
  for (const k of RPE_REST_KEYS) {
    const sk = String(k);
    if ((a[sk] ?? 0) !== (b[sk] ?? 0)) return false;
  }
  return true;
}

/** Clamp programmed rest to sensible range; snap to RPE ladder like settings. */
export function snapProgramRestSec(sec: number): number {
  const n = Math.round(sec);
  if (!Number.isFinite(n)) return 180;
  return snapRestSecToOption(Math.min(3600, Math.max(15, n)));
}
