import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema, resetSchema } from "./schemas";

describe("auth schemas", () => {
  it("rejects invalid login input", () => {
    const r = loginSchema.safeParse({ email: "nope", password: "" });
    expect(r.success).toBe(false);
  });

  it("accepts a valid student registration", () => {
    expect(registerSchema.safeParse({ role: "student", full_name: "Ada Lovelace", email: "ada@example.com", password: "Passw0rd1" }).success).toBe(true);
  });

  it("requires a company name for employers", () => {
    const r = registerSchema.safeParse({ role: "employer", full_name: "Boss Person", email: "b@example.com", password: "Passw0rd1" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(["company_name"]);
  });

  it("does not allow registering as admin", () => {
    expect(registerSchema.safeParse({ role: "admin", full_name: "Evil Admin", email: "e@example.com", password: "Passw0rd1" }).success).toBe(false);
  });

  it("enforces password strength", () => {
    const base = { role: "student", full_name: "Ada Lovelace", email: "ada@example.com" };
    expect(registerSchema.safeParse({ ...base, password: "short1" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: "onlyletters" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: "12345678" }).success).toBe(false);
  });

  it("checks that reset passwords match", () => {
    expect(resetSchema.safeParse({ password: "Passw0rd1", confirm: "different1" }).success).toBe(false);
    expect(resetSchema.safeParse({ password: "Passw0rd1", confirm: "Passw0rd1" }).success).toBe(true);
  });
});
