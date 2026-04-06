import { isAdminEmail } from "@/lib/auth/is-admin";

/** System templates have no owner; users may view/activate/duplicate only. */
export function userCanViewProgram(ownerId: string | null, userId: string): boolean {
  return ownerId === null || ownerId === userId;
}

export function userCanEditProgramStructure(ownerId: string | null, userId: string): boolean {
  return ownerId != null && ownerId === userId;
}

/** Owner programs, or admin editing system templates (ownerId null). */
export function userCanEditProgramIncludingAdmin(
  ownerId: string | null,
  userId: string,
  userEmail: string,
): boolean {
  if (ownerId != null && ownerId === userId) return true;
  if (ownerId == null && isAdminEmail(userEmail)) return true;
  return false;
}
