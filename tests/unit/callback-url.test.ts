import { describe, expect, it } from "vitest";

// AC-4: only internal callbackUrl values are honoured; anything else falls back to "/".
describe("AC-4 safeCallbackUrl", () => {
  const load = () => import("@/lib/auth/callback-url");

  it.each([
    ["/some/internal/path", "/some/internal/path"],
    ["/", "/"],
    ["/orders?status=new", "/orders?status=new"],
  ])("keeps internal path %s", async (input, expected) => {
    const { safeCallbackUrl } = await load();
    expect(safeCallbackUrl(input)).toBe(expected);
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "javascript:alert(1)",
    "/\\evil.example",
    "evil.example",
    "",
  ])("rejects %s", async (input) => {
    const { safeCallbackUrl } = await load();
    expect(safeCallbackUrl(input)).toBe("/");
  });

  it("falls back to / for null or undefined", async () => {
    const { safeCallbackUrl } = await load();
    expect(safeCallbackUrl(null)).toBe("/");
    expect(safeCallbackUrl(undefined)).toBe("/");
  });
});
