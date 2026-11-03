/**
 * Creates a staff user.
 *
 *   npm run create-user -- --target <local|staging|production> [--yes] <email>
 *
 * Settings come from the target's env file (variables already set in the shell win):
 * --target local reads .env and only accepts a local database host;
 * --target staging reads .env.staging, --target production reads .env.prod. Both need
 * PRODUCTION_DB_HOST, and ask you to type the target's name unless --yes is given.
 * The user is written over DATABASE_URL_UNPOOLED, the connection the guard checked.
 *
 * The password comes from CREATE_USER_PASSWORD or an interactive prompt,
 * never from the command line (it would end up in shell history).
 */
import { parseArgs } from "node:util";
import bcrypt from "bcryptjs";
import pg from "pg";
import { createUser as insertUser, UserExistsError } from "@/lib/db/queries/users";
import { emailSchema, passwordSchema } from "@/lib/validation/auth";
import { confirmTarget, exitWithError, type PreflightEnv, UsageError } from "./lib/cli";
import { readHiddenLine } from "./lib/read-hidden";
import { checkTarget, envValue, loadTargetEnv, parseTarget, type Target } from "./lib/target-guard";

const BCRYPT_COST = 12;
const USAGE = "usage: create-user --target <local|staging|production> [--yes] <email>";

/** Strict: unknown options are errors, and exactly one positional (the email) is allowed. */
export function parseCreateUserArgs(argv: readonly string[]): { target: string | undefined; yes: boolean; email: string } {
  let parsed: { values: { target?: string; yes?: boolean }; positionals: string[] };
  try {
    parsed = parseArgs({
      args: [...argv],
      options: { target: { type: "string" }, yes: { type: "boolean" } },
      strict: true,
      allowPositionals: true,
    });
  } catch (err) {
    throw new UsageError(`${(err as Error).message} (${USAGE})`);
  }
  if (parsed.positionals.length !== 1) {
    throw new UsageError(
      `expected one email, got ${parsed.positionals.length} arguments; the password is read from CREATE_USER_PASSWORD or a prompt, not from arguments (${USAGE})`,
    );
  }
  return { target: parsed.values.target, yes: parsed.values.yes ?? false, email: parsed.positionals[0] };
}

async function readPassword(env: Record<string, string | undefined> = process.env): Promise<string> {
  const fromEnv = env.CREATE_USER_PASSWORD;
  if (fromEnv) return fromEnv;
  if (!process.stdin.isTTY) throw new UsageError("no password: set CREATE_USER_PASSWORD or run interactively");
  // Typed input is not echoed, so the password never appears on screen or in scrollback.
  return readHiddenLine("Password: ");
}

/**
 * Every check before connecting: arguments, target, the database host guard, the email and,
 * for staging and production, the typed confirmation. Throws a one-line UsageError or
 * GuardError on refusal.
 */
export async function createUserPreflight(
  argv: readonly string[],
  { env = process.env, dir = process.cwd(), isTTY = Boolean(process.stdin.isTTY) }: PreflightEnv = {},
): Promise<{ target: Target; host: string; email: string }> {
  const args = parseCreateUserArgs(argv);
  const target = parseTarget(args.target);
  const envFile = loadTargetEnv(target, dir, env);
  const host = checkTarget(target, env);

  const email = emailSchema.safeParse(args.email);
  if (!email.success) throw new UsageError(`invalid email: ${args.email}`);

  if (target !== "local") {
    console.log(`Target ${target}: ${host} (settings from ${envFile ?? "the shell environment"})`);
    await confirmTarget(target, args.yes, `This creates user ${email.data} on ${target}.`, isTTY);
  }
  return { target, host, email: email.data };
}

/**
 * Validates the password, hashes it and inserts the user over `databaseUrl` (the connection
 * the guard checked). A duplicate email or a short password is a UsageError.
 */
export async function createUser(
  email: string,
  password: string,
  databaseUrl: string | undefined = envValue("DATABASE_URL_UNPOOLED"),
): Promise<{ id: number; email: string }> {
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) throw new UsageError(parsed.error.issues[0]?.message ?? "invalid password");
  const hash = await bcrypt.hash(parsed.data, BCRYPT_COST);

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const user = await insertUser(email, hash, client);
    return { id: Number(user.id), email: user.email };
  } catch (err) {
    if (err instanceof UserExistsError) throw new UsageError(err.message);
    throw err;
  } finally {
    await client.end();
  }
}

async function main(argv: readonly string[]): Promise<void> {
  const { target, email } = await createUserPreflight(argv);
  const user = await createUser(email, await readPassword());
  console.log(`Created user ${user.email} (id ${user.id}) on ${target}`);
}

if (process.argv[1] && /create-user\.ts$/.test(process.argv[1])) {
  main(process.argv.slice(2)).then(() => process.exit(0), exitWithError);
}
