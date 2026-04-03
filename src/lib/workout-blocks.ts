/** Client-safe helpers for session exercise order and superset clustering. */

export type WithIdSort = { id: string; sortOrder: number };
export type WithSuperset = WithIdSort & { supersetGroup: string | null };

export function parseExerciseOrderJson(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const ids = raw.filter((x): x is string => typeof x === "string");
  if (ids.length !== raw.length) return null;
  return ids;
}

export function orderExercises<T extends WithIdSort>(exercises: T[], order: string[] | null): T[] {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  if (
    order &&
    order.length === exercises.length &&
    order.every((id) => byId.has(id))
  ) {
    return order.map((id) => byId.get(id)!);
  }
  return [...exercises].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Consecutive rows sharing the same non-null supersetGroup form one block. */
export function clusterSupersetBlocks<T extends WithSuperset>(ordered: T[]): T[][] {
  const blocks: T[][] = [];
  for (const pe of ordered) {
    const last = blocks[blocks.length - 1];
    const g = pe.supersetGroup;
    if (
      last &&
      last[0] &&
      g != null &&
      g !== "" &&
      last[0].supersetGroup === g
    ) {
      last.push(pe);
    } else {
      blocks.push([pe]);
    }
  }
  return blocks;
}

export function flattenBlockOrder<T extends WithIdSort>(blocks: T[][]): string[] {
  return blocks.flatMap((b) => b.map((e) => e.id));
}
