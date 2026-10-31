import { describe, expect, it } from "vitest";

// AC-14 (password rule) and AC-5 (email normalisation), shared with spec 02's Users screen.
describe("AC-14 passwordSchema", () => {
  const load = () => import("@/lib/validation/auth");

  it("rejects an 11-character password", async () => {
    const { passwordSchema } = await load();
    expect(passwordSchema.safeParse("a".repeat(11)).success).toBe(false);
  });

  it("accepts a 12-character password with no other rules", async () => {
    const { passwordSchema } = await load();
    expect(passwordSchema.safeParse("aaaaaaaaaaaa").success).toBe(true);
  });
});

describe("AC-5 emailSchema", () => {
  it("trims and lowercases", async () => {
    const { emailSchema } = await import("@/lib/validation/auth");
    expect(emailSchema.parse("  Staff@Example.com ")).toBe("staff@example.com");
  });

  it("rejects a non-email", async () => {
    const { emailSchema } = await import("@/lib/validation/auth");
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });
});
