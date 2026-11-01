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
import { createUser, UserExistsError } from "@/lib/db/queries/users";
import { emailSchema, passwordSchema } from "@/lib/validation/auth";
import { confirmTarget, exitWithError, UsageError } from "./lib/cli";
import { readHiddenLine } from "./lib/read-hidden";
import { checkTarget, envValue, loadTargetEnv, parseTarget } from "./lib/target-guard";

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

async function readPassword(): Promise<string> {
  const fromEnv = process.env.CREATE_USER_PASSWORD;
  if (fromEnv) return fromEnv;
  if (!process.stdin.isTTY) throw new UsageError("no password: set CREATE_USER_PASSWORD or run interactively");
  // Typed input is not echoed, so the password never appears on screen or in scrollback.
  return readHiddenLine("Password: ");
}

async function main(argv: readonly string[]): Promise<void> {
  const args = parseCreateUserArgs(argv);
  const target = parseTarget(args.target);
  const envFile = loadTargetEnv(target);
  const host = checkTarget(target);

  const email = emailSchema.safeParse(args.email);
  if (!email.success) throw new UsageError(`invalid email: ${args.email}`);

  if (target !== "local") {
    console.log(`Target ${target}: ${host} (settings from ${envFile ?? "the shell environment"})`);
    await confirmTarget(target, args.yes, `This creates user ${email.data} on ${target}.`);
  }

  const password = passwordSchema.safeParse(await readPassword());
  if (!password.success) throw new UsageError(password.error.issues[0]?.message ?? "invalid password");
  const hash = await bcrypt.hash(password.data, BCRYPT_COST);

  const client = new pg.Client({ connectionString: envValue("DATABASE_URL_UNPOOLED") });
  await client.connect();
  try {
    const user = await createUser(email.data, hash, client);
    console.log(`Created user ${user.email} (id ${user.id}) on ${target}`);
  } catch (err) {
    if (err instanceof UserExistsError) throw new UsageError(err.message);
    throw err;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && /create-user\.ts$/.test(process.argv[1])) {
  main(process.argv.slice(2)).then(() => process.exit(0), exitWithError);
}
