/**
 * Shared CLI pieces for the operator scripts (create-user, seed-dummy, seed-old).
 */
import { createInterface } from "node:readline/promises";
import { GuardError, type Target } from "./target-guard";

/** A bad argument or setting: printed as one line, without a stack trace. */
export class UsageError extends Error {
  constructor(message: string) {
    super(`Error: ${message}`);
    this.name = "UsageError";
  }
}

/**
 * Asks the operator to type the target's name before a staging or production run.
 * `--yes` skips it; with no terminal (and no `--yes`) it refuses before connecting.
 */
export async function confirmTarget(target: Target, yes: boolean, what: string, isTTY = Boolean(process.stdin.isTTY)): Promise<void> {
  if (yes) return;
  if (!isTTY) {
    throw new GuardError(`--target ${target} needs a typed confirmation; run it in a terminal or pass --yes`);
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${what} Type "${target}" to continue: `);
  rl.close();
  if (answer.trim() !== target) throw new GuardError("confirmation did not match");
}

/** Prints the error and exits 1; refusals and usage errors as one line, anything else in full. */
export function exitWithError(err: unknown): never {
  console.error(err instanceof GuardError || err instanceof UsageError ? err.message : err);
  process.exit(1);
}

/** Where a script's checks read their settings from; injectable so the guards can be unit tested (spec 09 T I1). */
export type PreflightEnv = {
  env?: Record<string, string | undefined>;
  /** Directory holding the target's env file. */
  dir?: string;
  isTTY?: boolean;
};
