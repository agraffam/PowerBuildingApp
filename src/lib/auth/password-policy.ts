import { z } from "zod";

/** Tier A policy: length + block a small set of extremely common passwords. */
export const PASSWORD_MIN_LENGTH = 10;

const BLOCKED = new Set(
  [
    "password",
    "password123",
    "1234567890",
    "123456789",
    "qwerty123",
    "welcome123",
    "changeme",
    "letmein",
  ].map((s) => s.toLowerCase()),
);

export function passwordPolicyError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (BLOCKED.has(password.toLowerCase())) {
    return "Password is too common; choose something less guessable";
  }
  return null;
}

/** Use for register, account password change, etc. */
export const passwordFieldSchema = z.string().superRefine((val, ctx) => {
  const err = passwordPolicyError(val);
  if (err) {
    ctx.addIssue({ code: "custom", message: err });
  }
});
