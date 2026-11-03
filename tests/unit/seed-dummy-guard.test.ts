import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { seedPreflight } from "@/scripts/seed-dummy";

// Spec 09 T I1 (moved down from the spawned cases in tests/integration/seed-dummy-cli.test.ts):
// spec 03 AC-6 and AC-7, seed-dummy refuses before opening any connection. The checks run
// in-process against a complete environment in which only the rule under test is broken,
// an empty env-file directory and no terminal.
const UNRESOLVABLE = "postgres://x@seed-guard.invalid:1/none";
const valid = { DATABASE_URL_UNPOOLED: UNRESOLVABLE, PRODUCTION_DB_HOST: "other.invalid", FROM_CLIENT_ID: "1" };
const noFiles = mkdtempSync(join(tmpdir(), "seed-guard-"));
afterEach(() => vi.restoreAllMocks());

const preflight = (args: string[], env: Record<string, string>) => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  return seedPreflight(args, { env: { ...valid, ...env }, dir: noFiles, isTTY: false });
};
const refusal = (args: string[], env: Record<string, string> = {}) => preflight(args, env).then(() => null, (e: Error) => e.message);

describe("AC-6 refusals before connecting", () => {
  it.each<[string, string[], Record<string, string>, RegExp]>([
    ["--target production", ["--target", "production"], {}, /Refused: seed-dummy never runs against production/],
    ["no --target", [], {}, /Refused: --target is required/],
    ["--target prod", ["--target", "prod"], {}, /Refused: unknown --target "prod"/],
    ["--target local with a non-local host", ["--target", "local"], {}, /Refused: --target local only accepts a local database host/],
    ["--target staging without PRODUCTION_DB_HOST", ["--target", "staging", "--yes"], { PRODUCTION_DB_HOST: "" }, /Refused: PRODUCTION_DB_HOST must be set/],
    ["--target staging without FROM_CLIENT_ID", ["--target", "staging", "--yes"], { FROM_CLIENT_ID: "" }, /Refused: FROM_CLIENT_ID must be set/],
    [
      "--target staging with no terminal and no --yes",
      ["--target", "staging"],
      {},
      /Refused: --target staging needs a typed confirmation; run it in a terminal or pass --yes/,
    ],
  ])("%s", async (_name, args, override, message) => {
    expect(await refusal(args, override)).toMatch(message);
  });
});

describe("AC-7 production host and local hosts", () => {
  it("refuses --target staging --yes when the host is the production host", async () => {
    expect(await refusal(["--target", "staging", "--yes"], { PRODUCTION_DB_HOST: "seed-guard.invalid" })).toMatch(
      /Refused: DATABASE_URL_UNPOOLED points at the production database/,
    );
  });

  it.each(["localhost", "127.0.0.1", "db.localtest.me"])("lets --target local through for %s", async (host) => {
    await expect(preflight(["--target", "local"], { DATABASE_URL_UNPOOLED: `postgres://x@${host}:1/none` })).resolves.toMatchObject({
      target: "local",
      host,
    });
  });
});

describe("argument errors (review finding 3)", () => {
  const local = { DATABASE_URL_UNPOOLED: "postgres://x@localhost:1/none" };
  it.each<[string, string[], Record<string, string>, RegExp]>([
    ["an unknown option", ["--target", "local", "--sead", "5"], {}, /^Error: Unknown option '--sead'/],
    ["a non-integer --seed", ["--target", "local", "--seed", "abc"], {}, /^Error: --seed must be an integer, got "abc"/],
    ["a non-numeric FROM_CLIENT_ID", ["--target", "staging", "--yes"], { FROM_CLIENT_ID: "x" }, /^Error: FROM_CLIENT_ID must be a positive integer, got "x"/],
  ])("prints one line for %s, before connecting", async (_name, args, override, message) => {
    const msg = await refusal(args, { ...local, ...override });
    expect(msg).toMatch(message);
    expect(msg).not.toContain("\n");
  });

  it("accepts --target=local --seed=5", async () => {
    await expect(preflight(["--target=local", "--seed=5"], local)).resolves.toMatchObject({ target: "local", seed: 5 });
  });
});

describe("guard with Neon pooled and direct hosts (review finding 1)", () => {
  it("refuses --target staging --yes when PRODUCTION_DB_HOST is the pooled form of the URL's host", async () => {
    expect(
      await refusal(["--target", "staging", "--yes"], {
        DATABASE_URL_UNPOOLED: "postgres://x@ep-guard-1.seed-guard.invalid:1/none",
        PRODUCTION_DB_HOST: "ep-guard-1-pooler.seed-guard.invalid",
      }),
    ).toMatch(/Refused: DATABASE_URL_UNPOOLED points at the production database/);
  });
});
