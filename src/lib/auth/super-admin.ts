/** Single super-admin account (full user management). Normalize with this before comparing. */
export const SUPER_ADMIN_EMAIL = "agraffam@gmail.com";

export function normalizeEmailForAuth(email: string): string {
  return email.trim().toLowerCase();
}

export function isSuperAdminEmail(email: string): boolean {
  return normalizeEmailForAuth(email) === normalizeEmailForAuth(SUPER_ADMIN_EMAIL);
}
