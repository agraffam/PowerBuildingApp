export function effectiveUseBodyweight(pe: { useBodyweight: boolean | null }, ex: { isBodyweight: boolean }) {
  if (pe.useBodyweight != null) return pe.useBodyweight;
  return ex.isBodyweight;
}

/** Session override wins, then instance, then program slot, then exercise library default. */
export function effectiveUseBodyweightResolved(
  pe: { useBodyweight: boolean | null },
  ex: { isBodyweight: boolean },
  opts?: { sessionOverride?: boolean | null; instanceOverride?: boolean | null },
) {
  if (opts?.sessionOverride != null) return opts.sessionOverride;
  if (opts?.instanceOverride != null) return opts.instanceOverride;
  return effectiveUseBodyweight(pe, ex);
}
