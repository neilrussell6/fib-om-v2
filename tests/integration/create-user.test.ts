import { spawnSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { afterEach, describe, expect, it } from "vitest";
import { deleteUser, getUser } from "../helpers/test-db";

// AC-14: scripts/create-user.ts (run with --target local against the test database).
const run = (args: string[], env: Record<string, string | undefined> = {}) =>
  spawnSync("npx", ["tsx", "scripts/create-user.ts", "--target", "local", ...args], {
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

// Spec 01 revision 2026-11-01: --target and the shared guard (scripts/lib/target-guard.ts).
describe("create-user --target", () => {
  const UNRESOLVABLE = "postgres://x@seed-guard.invalid:1/none";
  const CONNECTION_ERROR = /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|getaddrinfo|connect /;
  const raw = (args: string[], env: Record<string, string>) =>
    spawnSync("npx", ["tsx", "scripts/create-user.ts", ...args], {
      env: { ...process.env, CREATE_USER_PASSWORD: "a-good-password-1", PRODUCTION_DB_HOST: "other.invalid", ...env },
      input: "",
      encoding: "utf8",
      timeout: 60_000,
    });

  it.each<[string, string[], Record<string, string>, RegExp]>([
    ["no --target", [email], {}, /Refused: --target is required/],
    ["an unknown target", ["--target", "prod", email], {}, /Refused: unknown --target "prod"/],
    ["--target local with a non-local host", ["--target", "local", email], { DATABASE_URL_UNPOOLED: UNRESOLVABLE }, /Refused: --target local only accepts a local database host/],
    ["--target staging without PRODUCTION_DB_HOST", ["--target", "staging", "--yes", email], { DATABASE_URL_UNPOOLED: UNRESOLVABLE, PRODUCTION_DB_HOST: "" }, /Refused: PRODUCTION_DB_HOST must be set/],
    [
      "--target staging on the production host (pooled form)",
      ["--target", "staging", "--yes", email],
      { DATABASE_URL_UNPOOLED: "postgres://x@ep-p.seed-guard.invalid:1/none", PRODUCTION_DB_HOST: "ep-p-pooler.seed-guard.invalid" },
      /Refused: DATABASE_URL_UNPOOLED points at the production database/,
    ],
    ["--target staging with no terminal and no --yes", ["--target", "staging", email], { DATABASE_URL_UNPOOLED: UNRESOLVABLE }, /Refused: --target staging needs a typed confirmation/],
    ["--target production with no terminal and no --yes", ["--target", "production", email], { DATABASE_URL_UNPOOLED: UNRESOLVABLE }, /Refused: --target production needs a typed confirmation/],
    ["an unknown option", ["--target", "local", "--force", email], {}, /Error: Unknown option '--force'/],
  ])("refuses %s before connecting, in one line", async (_name, args, env, message) => {
    const r = raw(args, env);
    const out = `${r.stdout}\n${r.stderr}`;
    expect(r.status).not.toBe(0);
    expect(out).toMatch(message);
    expect(out).not.toMatch(CONNECTION_ERROR);
    expect(out).not.toMatch(/\n\s+at /);
    expect(await getUser(email)).toBeUndefined();
  });

  it("lets --target production --yes through the guard (it then tries to connect)", () => {
    const r = raw(["--target", "production", "--yes", email], { DATABASE_URL_UNPOOLED: "postgres://x@localhost:1/none", PRODUCTION_DB_HOST: "localhost" });
    expect(r.status).not.toBe(0);
    expect(`${r.stdout}\n${r.stderr}`).not.toMatch(/Refused:/);
    expect(`${r.stdout}\n${r.stderr}`).toMatch(CONNECTION_ERROR);
  });
});
