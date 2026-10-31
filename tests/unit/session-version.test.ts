import { afterEach, describe, expect, it, vi } from "vitest";
import { checkSessionVersion } from "@/lib/auth/session-version";

// Spec 01 session version; review 02 (re-review) finding 1.
afterEach(() => vi.restoreAllMocks());

const token = { sub: "7", email: "a@b.co", sv: 3 };

describe("checkSessionVersion", () => {
  it("keeps a token whose version matches", async () => {
    await expect(checkSessionVersion(token, async () => 3)).resolves.toBe(token);
  });

  it("signs out a token whose version is out of date (signed out or password changed)", async () => {
    await expect(checkSessionVersion(token, async () => 4)).resolves.toBeNull();
  });

  it("signs out a deleted user", async () => {
    await expect(checkSessionVersion(token, async () => null)).resolves.toBeNull();
  });

  it("signs out a token without a user id", async () => {
    const noUser: { sub?: string; sv?: number } = { sv: 0 };
    await expect(checkSessionVersion(noUser, async () => 0)).resolves.toBeNull();
  });

  it("keeps the session and logs when the lookup itself fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      checkSessionVersion(token, async () => {
        throw new Error("connection timeout");
      }),
    ).resolves.toBe(token);
    expect(log).toHaveBeenCalled();
  });
});
