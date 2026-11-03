import { afterEach, describe, expect, it, vi } from "vitest";
import { checkSessionVersion } from "@/lib/auth/session-version";

// Spec 01 session version; review 02 (re-review) finding 1. Spec 09 P2: the lookup returns the
// user's row (version, name, email), and a valid session picks up the current name and email.
afterEach(() => vi.restoreAllMocks());

const token = { sub: "7", email: "a@b.co", sv: 3 };
const row = (sessionVersion: number) => ({ sessionVersion, name: "Ann", email: "ann@b.co" });

describe("checkSessionVersion", () => {
  it("keeps a token whose version matches", async () => {
    await expect(checkSessionVersion(token, async () => row(3))).resolves.toMatchObject({ sub: "7", sv: 3 });
  });

  it("09 P2: a valid session copies the name and email from the lookup", async () => {
    await expect(checkSessionVersion(token, async () => row(3))).resolves.toEqual({ ...token, name: "Ann", email: "ann@b.co" });
  });

  it("signs out a token whose version is out of date (signed out or password changed)", async () => {
    await expect(checkSessionVersion(token, async () => row(4))).resolves.toBeNull();
  });

  it("signs out a deleted user", async () => {
    await expect(checkSessionVersion(token, async () => null)).resolves.toBeNull();
  });

  it("signs out a token without a user id", async () => {
    const noUser: { sub?: string; sv?: number } = { sv: 0 };
    await expect(checkSessionVersion(noUser, async () => row(0))).resolves.toBeNull();
  });

  it("keeps the session unchanged and logs when the lookup itself fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      checkSessionVersion(token, async () => {
        throw new Error("connection timeout");
      }),
    ).resolves.toBe(token);
    expect(log).toHaveBeenCalled();
  });
});
