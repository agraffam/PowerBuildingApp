/**
 * Comma-separated admin emails (case-insensitive). Example: ADMIN_EMAILS=agraffam@gmail.com
 */
export function parseAdminEmailsFromEnv(): string[] {
  const raw = process.env.ADMIN_EMAILS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  return parseAdminEmailsFromEnv().includes(lower);
}
