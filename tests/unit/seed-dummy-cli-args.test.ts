import type pg from "pg";
import { describe, expect, it } from "vitest";
import { buildDataset, parseCliArgs, seedDummy, UsageError } from "@/scripts/seed-dummy";

// Spec 03 review findings 3 and 4.

describe("parseCliArgs (finding 3)", () => {
  it.each<[string[], { target?: string; seed: number; yes: boolean }]>([
    [["--target", "local"], { target: "local", seed: 1, yes: false }],
    [["--target=staging", "--seed=5", "--yes"], { target: "staging", seed: 5, yes: true }],
    [["--target", "local", "--seed", "42"], { target: "local", seed: 42, yes: false }],
    [["--seed=-3", "--target", "local"], { target: "local", seed: -3, yes: false }],
    [[], { target: undefined, seed: 1, yes: false }],
  ])("parses %j", (argv, expected) => {
    expect(parseCliArgs(argv)).toEqual(expected);
  });

  it.each<[string[], RegExp]>([
    [["--target", "local", "--sead", "5"], /^Error: Unknown option '--sead'/],
    [["--target", "local", "extra"], /^Error: .*positional/i],
    [["--target", "local", "--seed"], /^Error: Option '--seed <value>' argument missing/],
    [["--target", "local", "--seed", "abc"], /^Error: --seed must be an integer, got "abc"/],
    [["--target", "local", "--seed=1.5"], /^Error: --seed must be an integer, got "1.5"/],
    [["--target", "local", "--seed="], /^Error: --seed must be an integer, got ""/],
  ])("rejects %j", (argv, message) => {
    expect(() => parseCliArgs(argv)).toThrow(UsageError);
    expect(() => parseCliArgs(argv)).toThrow(message);
  });
});

describe("seedDummy keeps the original error when ROLLBACK fails (finding 4)", () => {
  it("rethrows the insert error, not the rollback error", async () => {
    const original = new Error("insert failed");
    const fake = {
      query: async (sql: string) => {
        if (sql.startsWith("INSERT")) throw original;
        if (sql === "ROLLBACK") throw new Error("Connection terminated");
        return { rows: [] };
      },
    } as unknown as pg.Client;
    await expect(seedDummy(fake, buildDataset(1, 1))).rejects.toBe(original);
  });
});
