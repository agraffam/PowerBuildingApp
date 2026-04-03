/** Shared secret for signing/verifying session JWTs (middleware + server routes). */
export function getJwtSecretKeyBytes(): Uint8Array {
  const secret =
    process.env.AUTH_SECRET ??
    (process.env.NODE_ENV === "production" ? undefined : "dev-insecure-auth-secret-change-me");
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET must be set (min 16 chars) in production");
  }
  return new TextEncoder().encode(secret);
}
