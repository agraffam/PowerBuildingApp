export function effectiveUseBodyweight(pe: { useBodyweight: boolean | null }, ex: { isBodyweight: boolean }) {
  if (pe.useBodyweight != null) return pe.useBodyweight;
  return ex.isBodyweight;
}
