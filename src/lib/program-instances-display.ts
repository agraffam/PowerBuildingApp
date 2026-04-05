/** One row per program: keep the most recently started pausable instance. */
export function dedupeInstancesByProgramId<
  T extends { programId: string; startedAt: string },
>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    if (seen.has(row.programId)) continue;
    seen.add(row.programId);
    out.push(row);
  }
  return out;
}
