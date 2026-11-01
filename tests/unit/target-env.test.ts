import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ENV_FILES, type Env, loadTargetEnv } from "@/scripts/lib/target-guard";

// Each --target reads its own env file: local .env, staging .env.staging, production .env.prod.

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "target-env-"));
  writeFileSync(join(dir, ".env"), "DATABASE_URL_UNPOOLED=postgres://u@localhost/main\nFROM_CLIENT_ID=1\n");
  writeFileSync(join(dir, ".env.staging"), "DATABASE_URL_UNPOOLED=postgres://u@ep-staging.neon.tech/db\nFROM_CLIENT_ID=20\nPRODUCTION_DB_HOST=ep-prod-pooler.neon.tech\n");
  writeFileSync(join(dir, ".env.prod"), "DATABASE_URL_UNPOOLED=postgres://u@ep-prod.neon.tech/db\n");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("loadTargetEnv", () => {
  it("maps targets to files", () => {
    expect(ENV_FILES).toEqual({ local: ".env", staging: ".env.staging", production: ".env.prod" });
  });

  it.each([
    ["local", "postgres://u@localhost/main"],
    ["staging", "postgres://u@ep-staging.neon.tech/db"],
    ["production", "postgres://u@ep-prod.neon.tech/db"],
  ] as const)("reads only the %s file", (target, url) => {
    const env: Env = {};
    expect(loadTargetEnv(target, dir, env)).toBe(ENV_FILES[target]);
    expect(env.DATABASE_URL_UNPOOLED).toBe(url);
    if (target !== "staging") expect(env.PRODUCTION_DB_HOST).toBeUndefined();
  });

  it("never mixes .env into a staging run", () => {
    rmSync(join(dir, ".env.staging"));
    const env: Env = {};
    expect(loadTargetEnv("staging", dir, env)).toBeUndefined();
    expect(env).toEqual({});
  });

  it("lets variables already set win, including empty ones", () => {
    const env: Env = { DATABASE_URL_UNPOOLED: "postgres://u@shell/db", FROM_CLIENT_ID: "" };
    loadTargetEnv("staging", dir, env);
    expect(env.DATABASE_URL_UNPOOLED).toBe("postgres://u@shell/db");
    expect(env.FROM_CLIENT_ID).toBe("");
    expect(env.PRODUCTION_DB_HOST).toBe("ep-prod-pooler.neon.tech");
  });
});
