import { describe, expect, it } from "vitest";
import { PASSWORD_MIN_LENGTH, passwordFieldSchema, passwordPolicyError } from "./password-policy";

describe("passwordPolicyError", () => {
  it("rejects short passwords", () => {
    expect(passwordPolicyError("a".repeat(PASSWORD_MIN_LENGTH - 1))).toMatch(/at least/);
  });
  it("accepts strong enough passwords", () => {
    expect(passwordPolicyError("x".repeat(PASSWORD_MIN_LENGTH))).toBeNull();
    expect(passwordPolicyError("MyL1ftPass!")).toBeNull();
  });
  it("rejects blocked passwords", () => {
    expect(passwordPolicyError("password123")).toMatch(/common/);
  });
});

describe("passwordFieldSchema", () => {
  it("parses valid passwords", () => {
    expect(passwordFieldSchema.safeParse("goodEnough9").success).toBe(true);
  });
  it("fails zod on policy violation", () => {
    const r = passwordFieldSchema.safeParse("short");
    expect(r.success).toBe(false);
  });
});
