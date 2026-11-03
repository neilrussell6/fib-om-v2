import { spawnSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { afterEach, describe, expect, it } from "vitest";
import { createUser } from "@/scripts/create-user";
import { deleteUser, getUser } from "../helpers/test-db";

// AC-14: scripts/create-user.ts against the test database. Spec 09 T I2: the cases call
// createUser in-process; one spawn of the real CLI stays, plus one spawned refusal (the
// other refusals are unit tests in tests/unit/create-user-guard.test.ts).
const run = (args: string[], env: Record<string, string | undefined> = {}) =>
  spawnSync("npx", ["tsx", "scripts/create-user.ts", ...args], {
    env: { ...process.env, CREATE_USER_PASSWORD: undefined, ...env },
    input: "", // stdin closed: no interactive password
    encoding: "utf8",
    timeout: 60_000,
  });

const email = "create-user-test@example.com";
afterEach(() => deleteUser(email));

const expectBcrypt = async (password: string) => {
  const user = await getUser(email);
  expect(user).toBeDefined();
  expect(user!.password_hash).not.toContain(password);
  expect(user!.password_hash).toMatch(/^\$2[aby]\$(\d\d)\$/);
  expect(Number(user!.password_hash.slice(4, 6))).toBeGreaterThanOrEqual(10);
  expect(await bcrypt.compare(password, user!.password_hash)).toBe(true);
};

describe("AC-14 create-user", () => {
  it("the CLI creates a user with a bcrypt hash, not plaintext", async () => {
    const password = "a-good-password-1";
    const r = run(["--target", "local", email], { CREATE_USER_PASSWORD: password });
    expect(r.status, r.stderr).toBe(0);
    await expectBcrypt(password);
  });

  it("creates a user with a bcrypt hash, not plaintext", async () => {
    await createUser(email, "a-good-password-2");
    await expectBcrypt("a-good-password-2");
  });

  it("stores the email lowercased", async () => {
    await createUser("Create-User-Test@Example.com", "a-good-password-1");
    expect((await getUser(email))?.email).toBe(email);
  });

  it("fails for an existing email and leaves the user unchanged", async () => {
    await createUser(email, "first-password-123");
    const before = await getUser(email);
    await expect(createUser(email, "second-password-456")).rejects.toThrow(/already exists/);
    expect(await getUser(email)).toEqual(before);
  });

  it("rejects an 11-character password and accepts a 12-character one", async () => {
    await expect(createUser(email, "a".repeat(11))).rejects.toThrow();
    expect(await getUser(email)).toBeUndefined();
    await expect(createUser(email, "a".repeat(12))).resolves.toMatchObject({ email });
  });
});

describe("create-user --target", () => {
  it("refuses --target staging on the production host (pooled form) before connecting, in one line", async () => {
    const r = spawnSync("npx", ["tsx", "scripts/create-user.ts", "--target", "staging", "--yes", email], {
      env: {
        ...process.env,
        CREATE_USER_PASSWORD: "a-good-password-1",
        DATABASE_URL_UNPOOLED: "postgres://x@ep-p.seed-guard.invalid:1/none",
        PRODUCTION_DB_HOST: "ep-p-pooler.seed-guard.invalid",
      },
      input: "",
      encoding: "utf8",
      timeout: 60_000,
    });
    const out = `${r.stdout}\n${r.stderr}`;
    expect(r.status).not.toBe(0);
    expect(out).toMatch(/Refused: DATABASE_URL_UNPOOLED points at the production database/);
    expect(out).not.toMatch(/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|getaddrinfo|connect /);
    expect(out).not.toMatch(/\n\s+at /);
    expect(await getUser(email)).toBeUndefined();
  });
});
