import { afterEach, describe, expect, it, vi } from "vitest";

// Spec 09 P2 / AC-8: the Auth.js callbacks, taking their user lookup as a parameter.
afterEach(() => vi.restoreAllMocks());

const load = () => import("@/lib/auth/callbacks");
const row = { sessionVersion: 3, name: "Neil Russell", email: "neil@example.com" };
const token = { sub: "7", email: "old@example.com", sv: 3 };

describe("09 AC-8 jwtCallback", () => {
  it("a matching version keeps the session and copies the name and email from the lookup", async () => {
    const { jwtCallback } = await load();
    const lookup = vi.fn(async () => row);
    await expect(jwtCallback({ token }, lookup)).resolves.toEqual({ ...token, name: "Neil Russell", email: "neil@example.com" });
    expect(lookup).toHaveBeenCalledWith("7");
  });

  it("a version mismatch signs out", async () => {
    const { jwtCallback } = await load();
    await expect(jwtCallback({ token }, async () => ({ ...row, sessionVersion: 4 }))).resolves.toBeNull();
  });

  it("a missing user signs out", async () => {
    const { jwtCallback } = await load();
    await expect(jwtCallback({ token }, async () => null)).resolves.toBeNull();
  });

  it("a lookup error keeps the token unchanged", async () => {
    const { jwtCallback } = await load();
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      jwtCallback({ token }, async () => {
        throw new Error("timeout");
      }),
    ).resolves.toEqual(token);
  });

  it("sign-in sets sub, email, sv and name from the user, without a lookup", async () => {
    const { jwtCallback } = await load();
    const lookup = vi.fn();
    const user = { id: "9", email: "new@example.com", name: "New Person", sessionVersion: 2 };
    await expect(jwtCallback({ token: {}, user }, lookup)).resolves.toMatchObject({ sub: "9", email: "new@example.com", sv: 2, name: "New Person" });
    expect(lookup).not.toHaveBeenCalled();
  });

  it("sign-in without a name stores null", async () => {
    const { jwtCallback } = await load();
    const out = await jwtCallback({ token: {}, user: { id: "9", email: "new@example.com" } }, vi.fn());
    expect(out).toMatchObject({ name: null, sv: 0 });
  });
});

describe("09 AC-8 sessionCallback", () => {
  it("exposes the user's id, email and name", async () => {
    const { sessionCallback } = await load();
    const session = { user: { id: "", email: "", name: undefined as string | null | undefined }, expires: "x" };
    const out = sessionCallback({ session, token: { sub: "7", email: "neil@example.com", name: "Neil Russell" } });
    expect(out.user).toEqual({ id: "7", email: "neil@example.com", name: "Neil Russell" });
  });

  it("a token without a name gives a null name", async () => {
    const { sessionCallback } = await load();
    const session = { user: { id: "", email: "" }, expires: "x" };
    const out = sessionCallback({ session, token: { sub: "7", email: "neil@example.com" } });
    expect(out.user).toMatchObject({ name: null });
  });
});
