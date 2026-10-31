import { tx } from "@/lib/db";

export const SIGN_IN_LIMIT = 10;
export const SIGN_IN_WINDOW_MS = 60_000;
const RETENTION_MS = 60 * 60_000;

/**
 * Spec 01: at most 10 sign-in attempts per minute per IP. Records the attempt
 * when allowed; a refused attempt is not recorded and the password is never checked.
 */
export async function checkSignInRateLimit(ip: string, now: Date = new Date()): Promise<{ allowed: boolean }> {
  return tx(async (client) => {
    // Serialise attempts from the same IP so concurrent requests can't both slip under the limit.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [ip]);
    await client.query("DELETE FROM login_attempts WHERE attempted_at < $1", [new Date(now.getTime() - RETENTION_MS)]);
    const { rows } = await client.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM login_attempts WHERE ip = $1 AND attempted_at > $2",
      [ip, new Date(now.getTime() - SIGN_IN_WINDOW_MS)],
    );
    if (rows[0].n >= SIGN_IN_LIMIT) return { allowed: false };
    await client.query("INSERT INTO login_attempts (ip, attempted_at) VALUES ($1, $2)", [ip, now]);
    return { allowed: true };
  });
}
