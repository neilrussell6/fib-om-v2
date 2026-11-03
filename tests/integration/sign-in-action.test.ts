import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { clearLoginAttempts } from "../helpers/test-db";

// Spec 09 T E9 (moved down from e2e login.spec, spec 01 AC-19): the login action checks the
// sign-in limit before Auth.js sees the password. Auth.js's signIn and the request headers
// are mocked; the limiter is the real one, against the test database.
const ip = `198.51.100.${(Date.now() % 200) + 20}`;
const signIn = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ signIn }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": ip }) }));
// next-auth's package entry can't load outside Next; the action only needs its error classes.
const errors = vi.hoisted(() => {
  class AuthError extends Error {}
  class CredentialsSignin extends AuthError {}
  return { AuthError, CredentialsSignin };
});
vi.mock("next-auth", () => errors);

beforeEach(() => signIn.mockReset());
afterAll(() => clearLoginAttempts(ip));

const form = (password: string) => {
  const f = new FormData();
  f.set("email", "limit-test@example.com");
  f.set("password", password);
  return f;
};

describe("spec 01 AC-19 via signInAction", () => {
  it("lets 10 attempts reach signIn, then refuses the 11th without checking the password", async () => {
    await clearLoginAttempts(ip);
    const { signInAction } = await import("@/app/(auth)/login/actions");
    const { INVALID_CREDENTIALS, TOO_MANY_ATTEMPTS } = await import("@/app/(auth)/login/messages");

    signIn.mockRejectedValue(new errors.CredentialsSignin());
    for (let i = 0; i < 10; i++) {
      await expect(signInAction({}, form(`wrong-password-${i}x`))).resolves.toEqual({ error: INVALID_CREDENTIALS });
    }
    expect(signIn).toHaveBeenCalledTimes(10);

    // The right password, but the limit applies first.
    signIn.mockReset();
    await expect(signInAction({}, form("limit-password-123"))).resolves.toEqual({ error: TOO_MANY_ATTEMPTS });
    expect(signIn).not.toHaveBeenCalled();
  });
});
