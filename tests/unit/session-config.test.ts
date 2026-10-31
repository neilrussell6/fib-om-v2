import { describe, expect, it } from "vitest";

// AC-6: JWT sessions, 8-hour rolling lifetime, refreshed after 15 minutes.
describe("AC-6 session config", () => {
  it("uses JWT sessions with maxAge 8h and updateAge 15 minutes", async () => {
    const { sessionConfig } = await import("@/lib/auth/session-config");
    expect(sessionConfig).toEqual({ strategy: "jwt", maxAge: 8 * 60 * 60, updateAge: 15 * 60 });
  });
});
