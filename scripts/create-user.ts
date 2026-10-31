/**
 * Creates a staff user.
 *
 *   npm run create-user -- <email>
 *
 * The password comes from CREATE_USER_PASSWORD or an interactive prompt,
 * never from the command line (it would end up in shell history).
 */
import { createInterface } from "node:readline/promises";
import bcrypt from "bcryptjs";
import { createUser, UserExistsError } from "@/lib/db/queries/users";
import { emailSchema, passwordSchema } from "@/lib/validation/auth";

const BCRYPT_COST = 12;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function readPassword(): Promise<string> {
  const fromEnv = process.env.CREATE_USER_PASSWORD;
  if (fromEnv) return fromEnv;
  if (!process.stdin.isTTY) {
    fail("No password: set CREATE_USER_PASSWORD or run interactively.");
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question("Password: ");
  } finally {
    rl.close();
  }
}

async function main() {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env file: use the environment as is.
  }

  const args = process.argv.slice(2);
  if (args.length !== 1) {
    fail("Usage: create-user <email>\nThe password is read from CREATE_USER_PASSWORD or a prompt, not from arguments.");
  }

  const email = emailSchema.safeParse(args[0]);
  if (!email.success) fail(`Invalid email: ${args[0]}`);

  const password = passwordSchema.safeParse(await readPassword());
  if (!password.success) fail(password.error.issues[0]?.message ?? "Invalid password");

  const hash = await bcrypt.hash(password.data, BCRYPT_COST);
  try {
    const user = await createUser(email.data, hash);
    console.log(`Created user ${user.email} (id ${user.id})`);
  } catch (err) {
    if (err instanceof UserExistsError) fail(err.message);
    throw err;
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
