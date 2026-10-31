import { spawnSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { afterEach, describe, expect, it } from "vitest";
import { deleteUser, getUser } from "../helpers/test-db";

// AC-14: scripts/create-user.ts
const run = (args: string[], env: Record<string, string | undefined> = {}) =>
  spawnSync("npx", ["tsx", "scripts/create-user.ts", ...args], {
    env: { ...process.env, CREATE_USER_PASSWORD: undefined, ...env },
    input: "", // stdin closed: no interactive password
    encoding: "utf8",
    timeout: 60_000,
  });

const email = "create-user-test@example.com";
afterEach(() => deleteUser(email));

describe("AC-14 create-user", () => {
  it("creates a user with a bcrypt hash, not plaintext", async () => {
    const password = "a-good-password-1";
    const r = run([email], { CREATE_USER_PASSWORD: password });
    expect(r.status, r.stderr).toBe(0);
    const user = await getUser(email);
    expect(user).toBeDefined();
    expect(user!.password_hash).not.toContain(password);
    expect(user!.password_hash).toMatch(/^\$2[aby]\$(\d\d)\$/);
    expect(Number(user!.password_hash.slice(4, 6))).toBeGreaterThanOrEqual(10);
    expect(await bcrypt.compare(password, user!.password_hash)).toBe(true);
  });

  it("stores the email lowercased", async () => {
    const r = run(["Create-User-Test@Example.com"], { CREATE_USER_PASSWORD: "a-good-password-1" });
    expect(r.status, r.stderr).toBe(0);
    expect((await getUser(email))?.email).toBe(email);
  });

  it("fails for an existing email and leaves the user unchanged", async () => {
    expect(run([email], { CREATE_USER_PASSWORD: "first-password-123" }).status).toBe(0);
    const before = await getUser(email);
    const r = run([email], { CREATE_USER_PASSWORD: "second-password-456" });
    expect(r.status).not.toBe(0);
    expect(await getUser(email)).toEqual(before);
  });

  it("rejects an 11-character password and accepts a 12-character one", async () => {
    const short = run([email], { CREATE_USER_PASSWORD: "a".repeat(11) });
    expect(short.status).not.toBe(0);
    expect(await getUser(email)).toBeUndefined();
    expect(run([email], { CREATE_USER_PASSWORD: "a".repeat(12) }).status).toBe(0);
  });

  it("does not take the password from the command line", async () => {
    const r = run([email, "argv-password-123"]);
    expect(r.status).not.toBe(0);
    expect(await getUser(email)).toBeUndefined();
  });
});
