import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createUserPreflight } from "@/scripts/create-user";

// Spec 09 T I1 (moved down from the spawned cases in tests/integration/create-user.test.ts,
// spec 01 revision 2026-11-01): create-user refuses before connecting. The checks run
// in-process against a given environment, an empty env-file directory and no terminal.
const email = "create-user-test@example.com";
const UNRESOLVABLE = "postgres://x@seed-guard.invalid:1/none";
const noFiles = mkdtempSync(join(tmpdir(), "create-user-guard-"));
afterEach(() => vi.restoreAllMocks());

const preflight = (args: string[], env: Record<string, string>) => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  return createUserPreflight(args, { env: { PRODUCTION_DB_HOST: "other.invalid", ...env }, dir: noFiles, isTTY: false });
};

describe("create-user --target", () => {
  it.each<[string, string[], Record<string, string>, RegExp]>([
    ["no --target", [email], {}, /^Refused: --target is required/],
    ["an unknown target", ["--target", "prod", email], {}, /^Refused: unknown --target "prod"/],
    ["--target local with a non-local host", ["--target", "local", email], { DATABASE_URL_UNPOOLED: UNRESOLVABLE }, /^Refused: --target local only accepts a local database host/],
    ["--target staging without PRODUCTION_DB_HOST", ["--target", "staging", "--yes", email], { DATABASE_URL_UNPOOLED: UNRESOLVABLE, PRODUCTION_DB_HOST: "" }, /^Refused: PRODUCTION_DB_HOST must be set/],
    [
      "--target staging on the production host (pooled form)",
      ["--target", "staging", "--yes", email],
      { DATABASE_URL_UNPOOLED: "postgres://x@ep-p.seed-guard.invalid:1/none", PRODUCTION_DB_HOST: "ep-p-pooler.seed-guard.invalid" },
      /^Refused: DATABASE_URL_UNPOOLED points at the production database/,
    ],
    ["--target staging with no terminal and no --yes", ["--target", "staging", email], { DATABASE_URL_UNPOOLED: UNRESOLVABLE }, /^Refused: --target staging needs a typed confirmation/],
    ["--target production with no terminal and no --yes", ["--target", "production", email], { DATABASE_URL_UNPOOLED: UNRESOLVABLE }, /^Refused: --target production needs a typed confirmation/],
    ["an unknown option", ["--target", "local", "--force", email], { DATABASE_URL_UNPOOLED: "postgres://x@localhost:1/none" }, /^Error: Unknown option '--force'/],
  ])("refuses %s before connecting, in one line", async (_name, args, env, message) => {
    const err = await preflight(args, env).then(() => null, (e: Error) => e);
    expect(err?.message).toMatch(message);
    expect(err?.message).not.toContain("\n");
  });

  it("lets --target production --yes through the guard", async () => {
    await expect(
      preflight(["--target", "production", "--yes", email], { DATABASE_URL_UNPOOLED: "postgres://x@localhost:1/none", PRODUCTION_DB_HOST: "localhost" }),
    ).resolves.toMatchObject({ target: "production", host: "localhost", email });
  });
});
