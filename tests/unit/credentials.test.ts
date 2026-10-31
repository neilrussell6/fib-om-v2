import bcrypt from "bcryptjs";
import { afterEach, describe, expect, it, vi } from "vitest";

// AC-5: same outcome and same work (a bcrypt compare) for a wrong password and an unknown email;
// emails are matched case-insensitively.
const hash = bcrypt.hashSync("correct horse battery", 4);
const user = { id: 1, email: "staff@example.com", password_hash: hash };

const findUserByEmail = vi.fn(async (email: string) => (email === user.email ? user : null));

afterEach(() => {
  vi.restoreAllMocks();
  findUserByEmail.mockClear();
});

describe("AC-5 verifyCredentials", () => {
  const load = () => import("@/lib/auth/credentials");

  it("returns the user for the right password", async () => {
    const { verifyCredentials } = await load();
    await expect(
      verifyCredentials({ email: "staff@example.com", password: "correct horse battery" }, { findUserByEmail }),
    ).resolves.toEqual({ id: "1", email: "staff@example.com" });
  });

  it("matches the email case-insensitively and trimmed", async () => {
    const { verifyCredentials } = await load();
    await expect(
      verifyCredentials({ email: "  Staff@Example.com ", password: "correct horse battery" }, { findUserByEmail }),
    ).resolves.toEqual({ id: "1", email: "staff@example.com" });
    expect(findUserByEmail).toHaveBeenCalledWith("staff@example.com");
  });

  it("returns null and calls bcrypt compare for a wrong password", async () => {
    const { verifyCredentials } = await load();
    const spy = vi.spyOn(bcrypt, "compare");
    await expect(
      verifyCredentials({ email: "staff@example.com", password: "wrong password!!" }, { findUserByEmail }),
    ).resolves.toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("returns null and still calls bcrypt compare for an unknown email", async () => {
    const { verifyCredentials } = await load();
    const spy = vi.spyOn(bcrypt, "compare");
    await expect(
      verifyCredentials({ email: "nobody@example.com", password: "anything at all" }, { findUserByEmail }),
    ).resolves.toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("returns null without throwing for malformed input", async () => {
    const { verifyCredentials } = await load();
    await expect(verifyCredentials({ email: 42, password: undefined }, { findUserByEmail })).resolves.toBeNull();
  });
});
