import { describe, expect, it } from "vitest";
import { z } from "zod";

// Spec 09 code quality / AC-13: one field-error mapping for both Server Action modules.
describe("09 AC-13 fieldErrorsFrom", () => {
  it("maps each issue to its top-level field, keeping the first message per field", async () => {
    const { fieldErrorsFrom } = await import("@/lib/resources/schema");
    const schema = z.object({ name: z.string().min(1, "please provide a name"), qty: z.number().int().min(1, "too small").max(5, "too big") });
    const r = schema.safeParse({ name: "", qty: 0.5 });
    expect(r.success).toBe(false);
    if (r.success) return;
    const errs = fieldErrorsFrom(r.error.issues);
    expect(errs.name).toBe("please provide a name");
    expect(Object.keys(errs).sort()).toEqual(["name", "qty"]);
    expect(typeof errs.qty).toBe("string");
  });

  it("returns {} for no issues", async () => {
    const { fieldErrorsFrom } = await import("@/lib/resources/schema");
    expect(fieldErrorsFrom([])).toEqual({});
  });

  it("the same issue list gives the same result as the old loop", async () => {
    const { fieldErrorsFrom } = await import("@/lib/resources/schema");
    const issues = [
      { path: ["a"], message: "first" },
      { path: ["a"], message: "second" },
      { path: ["b", 0], message: "nested" },
    ] as unknown as z.core.$ZodIssue[];
    expect(fieldErrorsFrom(issues)).toEqual({ a: "first", b: "nested" });
  });
});
