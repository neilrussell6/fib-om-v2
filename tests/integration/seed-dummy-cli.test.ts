import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// Spec 03 AC-6, AC-7: scripts/seed-dummy.ts refuses before opening any connection.
// Every case gets a complete environment in which only the rule under test is broken;
// a variable that must be "missing" is passed as an empty string, because the script
// reads .env for --target local and .env would otherwise fill it back in.

const UNRESOLVABLE = "postgres://x@seed-guard.invalid:1/none";
const CONNECTION_ERROR = /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|getaddrinfo|connect /;

type Env = { DATABASE_URL_UNPOOLED: string; PRODUCTION_DB_HOST: string; FROM_CLIENT_ID: string };

const run = (args: string[], env: Env) => {
  const r = spawnSync("npx", ["tsx", "scripts/seed-dummy.ts", ...args], {
    env: { ...process.env, ...env },
    input: "", // stdin is not a terminal
    encoding: "utf8",
    timeout: 60_000,
  });
  return { status: r.status, out: `${r.stdout}\n${r.stderr}` };
};

const valid: Env = { DATABASE_URL_UNPOOLED: UNRESOLVABLE, PRODUCTION_DB_HOST: "other.invalid", FROM_CLIENT_ID: "1" };

describe("AC-6 refusals before connecting", () => {
  it.each<[string, string[], Partial<Env>, RegExp]>([
    ["--target production", ["--target", "production"], {}, /Refused: seed-dummy never runs against production/],
    ["no --target", [], {}, /Refused: --target is required/],
    ["--target prod", ["--target", "prod"], {}, /Refused: unknown --target "prod"/],
    ["--target local with a non-local host", ["--target", "local"], {}, /Refused: --target local only accepts a local database host/],
    [
      "--target staging without PRODUCTION_DB_HOST",
      ["--target", "staging", "--yes"],
      { PRODUCTION_DB_HOST: "" },
      /Refused: PRODUCTION_DB_HOST must be set/,
    ],
    [
      "--target staging without FROM_CLIENT_ID",
      ["--target", "staging", "--yes"],
      { FROM_CLIENT_ID: "" },
      /Refused: FROM_CLIENT_ID must be set/,
    ],
    [
      "--target staging with no terminal and no --yes",
      ["--target", "staging"],
      {},
      /Refused: --target staging needs a typed confirmation; run it in a terminal or pass --yes/,
    ],
  ])("%s", (_name, args, override, message) => {
    const r = run(args, { ...valid, ...override });
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(message);
    expect(r.out).not.toMatch(CONNECTION_ERROR);
  });
});

describe("AC-7 production host and local hosts", () => {
  it("refuses --target staging --yes when the host is the production host", () => {
    const r = run(["--target", "staging", "--yes"], { ...valid, PRODUCTION_DB_HOST: "seed-guard.invalid" });
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(/Refused: DATABASE_URL_UNPOOLED points at the production database/);
    expect(r.out).not.toMatch(CONNECTION_ERROR);
  });

  it.each(["localhost", "127.0.0.1", "db.localtest.me"])("lets --target local through for %s", (host) => {
    const r = run(["--target", "local"], { ...valid, DATABASE_URL_UNPOOLED: `postgres://x@${host}:1/none` });
    expect(r.status).not.toBe(0);
    expect(r.out).not.toMatch(/Refused:/);
    expect(r.out).toMatch(CONNECTION_ERROR);
  });
});

describe("argument errors (review finding 3)", () => {
  const STACK = /\n\s+at /;
  it.each<[string, string[], Partial<Env>, RegExp]>([
    ["an unknown option", ["--target", "local", "--sead", "5"], {}, /Error: Unknown option '--sead'/],
    ["a non-integer --seed", ["--target", "local", "--seed", "abc"], {}, /Error: --seed must be an integer, got "abc"/],
    [
      "a non-numeric FROM_CLIENT_ID",
      ["--target", "staging", "--yes"],
      { FROM_CLIENT_ID: "x" },
      /Error: FROM_CLIENT_ID must be a positive integer, got "x"/,
    ],
  ])("prints one line for %s, before connecting", (_name, args, override, message) => {
    const r = run(args, { ...valid, DATABASE_URL_UNPOOLED: "postgres://x@localhost:1/none", ...override });
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(message);
    expect(r.out).not.toMatch(STACK);
    expect(r.out).not.toMatch(CONNECTION_ERROR);
  });

  it("accepts --target=local --seed=5", () => {
    const r = run(["--target=local", "--seed=5"], { ...valid, DATABASE_URL_UNPOOLED: "postgres://x@localhost:1/none" });
    expect(r.status).not.toBe(0);
    expect(r.out).not.toMatch(/Refused:|Unknown option|must be an integer|argument missing/);
    expect(r.out).toMatch(CONNECTION_ERROR);
  });
});

describe("guard with Neon pooled and direct hosts (review finding 1)", () => {
  it("refuses --target staging --yes when PRODUCTION_DB_HOST is the pooled form of the URL's host", () => {
    const r = run(["--target", "staging", "--yes"], {
      ...valid,
      DATABASE_URL_UNPOOLED: "postgres://x@ep-guard-1.seed-guard.invalid:1/none",
      PRODUCTION_DB_HOST: "ep-guard-1-pooler.seed-guard.invalid",
    });
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(/Refused: DATABASE_URL_UNPOOLED points at the production database/);
    expect(r.out).not.toMatch(CONNECTION_ERROR);
  });
});
