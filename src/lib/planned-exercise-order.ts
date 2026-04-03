/** Parsed shape of ProgramInstance.plannedExerciseOrderByDay */
export type PlannedExerciseOrderMap = Record<string, string[]>;

export function parsePlanOrderMap(raw: unknown): PlannedExerciseOrderMap | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: PlannedExerciseOrderMap = {};
  for (const [k, v] of Object.entries(o)) {
    if (Array.isArray(v) && v.every((x) => typeof x === "string")) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

/** Returns ordered PE ids for this day if the stored plan matches current exercises exactly. */
export function getValidatedPlannedOrder(
  programDayId: string,
  programExerciseIds: string[],
  map: PlannedExerciseOrderMap | null,
): string[] | undefined {
  if (!map) return undefined;
  const order = map[programDayId];
  if (!order?.length) return undefined;
  const expected = new Set(programExerciseIds);
  if (order.length !== expected.size) return undefined;
  for (const id of order) {
    if (!expected.has(id)) return undefined;
  }
  return order;
}
