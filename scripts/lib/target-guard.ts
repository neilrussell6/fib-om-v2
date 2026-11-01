/**
 * Safety guard for the data scripts (spec 03, reused by seed-old in spec 05).
 * Runs before any database connection is opened; every refusal is a GuardError whose
 * message starts with "Refused:" and names the rule.
 */

export const TARGETS = ["local", "staging", "production"] as const;
export type Target = (typeof TARGETS)[number];

export const LOCAL_HOSTS = ["localhost", "127.0.0.1", "db.localtest.me"] as const;

export class GuardError extends Error {
  constructor(message: string) {
    super(`Refused: ${message}`);
    this.name = "GuardError";
  }
}

/** An empty value counts as unset (a test or shell may pass VAR= to clear it). */
export function envValue(name: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  const v = env[name]?.trim();
  return v ? v : undefined;
}

/** Reads `--target <value>` (or `--target=<value>`) from argv; undefined when absent. */
export function targetArg(argv: readonly string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--target") return argv[i + 1];
    if (a.startsWith("--target=")) return a.slice("--target=".length);
  }
  return undefined;
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
 * The rules shared by every data script:
 * - `local` only accepts a local database host;
 * - `staging` and `production` need PRODUCTION_DB_HOST;
 * - a host equal to PRODUCTION_DB_HOST is refused unless the target is `production`.
 * Returns the database host.
 */
export function checkTarget(target: Target, env: NodeJS.ProcessEnv = process.env): string {
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
  if (target !== "production" && host === productionHost) {
    throw new GuardError(`DATABASE_URL_UNPOOLED points at the production database (${host}), but --target is ${target}`);
  }
  return host;
}

/** True when DATABASE_URL_UNPOOLED's host is the production host (for scripts that never touch production). */
export function isProductionHost(env: NodeJS.ProcessEnv = process.env): boolean {
  const productionHost = envValue("PRODUCTION_DB_HOST", env)?.toLowerCase();
  if (!productionHost) return false;
  return hostOf(envValue("DATABASE_URL_UNPOOLED", env)) === productionHost;
}
