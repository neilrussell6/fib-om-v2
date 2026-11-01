import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "node:util";

/**
 * Safety guard for the data scripts (spec 03, reused by seed-old in spec 05).
 * Runs before any database connection is opened; every refusal is a GuardError whose
 * message starts with "Refused:" and names the rule.
 */

export const TARGETS = ["local", "staging", "production"] as const;
export type Target = (typeof TARGETS)[number];

/** process.env, or a plain object in tests. */
export type Env = Record<string, string | undefined>;

export const LOCAL_HOSTS = ["localhost", "127.0.0.1", "db.localtest.me"] as const;

export class GuardError extends Error {
  constructor(message: string) {
    super(`Refused: ${message}`);
    this.name = "GuardError";
  }
}

/** The env file each target reads; all are gitignored (`.env*`). */
export const ENV_FILES: Record<Target, string> = { local: ".env", staging: ".env.staging", production: ".env.prod" };

/**
 * Loads the target's env file, if present, into env. Variables already set (even to "")
 * win over the file, so a session or test can override it. Only that target's file is
 * read, so local settings never mix into a staging or production run. Returns the file
 * name when one was read.
 */
export function loadTargetEnv(target: Target, dir: string = process.cwd(), env: Env = process.env): string | undefined {
  const file = ENV_FILES[target];
  let text: string;
  try {
    text = readFileSync(join(dir, file), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw err;
  }
  for (const [key, value] of Object.entries(parseEnv(text))) if (env[key] === undefined) env[key] = value;
  return file;
}

/** An empty value counts as unset (a test or shell may pass VAR= to clear it). */
export function envValue(name: string, env: Env = process.env): string | undefined {
  const v = env[name]?.trim();
  return v ? v : undefined;
}

export function parseTarget(value: string | undefined): Target {
  if (value === undefined || value === "") throw new GuardError("--target is required (local, staging or production)");
  if (!(TARGETS as readonly string[]).includes(value)) {
    throw new GuardError(`unknown --target "${value}" (expected local, staging or production)`);
  }
  return value as Target;
}

export function hostOf(databaseUrl: string | undefined): string {
  if (!databaseUrl) throw new GuardError("DATABASE_URL_UNPOOLED must be set");
  try {
    return new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    throw new GuardError("DATABASE_URL_UNPOOLED is not a valid connection string");
  }
}

/**
 * One name per Neon endpoint: Neon serves each branch on a direct host (`ep-x.<region>…`) and a
 * pooled one (`ep-x-pooler.<region>…`). Dropping "-pooler" from the first label lets the
 * production-host check match whichever form either variable holds.
 */
export function endpointHost(host: string): string {
  const [first, ...rest] = host.toLowerCase().split(".");
  return [first.replace(/-pooler$/, ""), ...rest].join(".");
}

/**
 * The rules shared by every data script:
 * - `local` only accepts a local database host;
 * - `staging` and `production` need PRODUCTION_DB_HOST;
 * - a host on PRODUCTION_DB_HOST's endpoint (pooled or direct) is refused unless the target is `production`.
 * Returns the database host.
 */
export function checkTarget(target: Target, env: Env = process.env): string {
  const host = hostOf(envValue("DATABASE_URL_UNPOOLED", env));
  if (target === "local") {
    if (!(LOCAL_HOSTS as readonly string[]).includes(host)) {
      throw new GuardError(
        `--target local only accepts a local database host (${LOCAL_HOSTS.join(", ")}); DATABASE_URL_UNPOOLED points at ${host}`,
      );
    }
    return host;
  }
  const productionHost = envValue("PRODUCTION_DB_HOST", env)?.toLowerCase();
  if (!productionHost) throw new GuardError(`PRODUCTION_DB_HOST must be set for --target ${target}`);
  if (target !== "production" && endpointHost(host) === endpointHost(productionHost)) {
    throw new GuardError(`DATABASE_URL_UNPOOLED points at the production database (${host}), but --target is ${target}`);
  }
  return host;
}

/** True when DATABASE_URL_UNPOOLED is on the production endpoint (for scripts that never touch production). */
export function isProductionHost(env: Env = process.env): boolean {
  const productionHost = envValue("PRODUCTION_DB_HOST", env);
  if (!productionHost) return false;
  return endpointHost(hostOf(envValue("DATABASE_URL_UNPOOLED", env))) === endpointHost(productionHost);
}
