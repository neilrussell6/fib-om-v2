/**
 * Decides whether a session token is still valid against the user's current
 * session version (spec 01, session version). Returns the token, or null to
 * sign the request out.
 *
 * Only a confirmed mismatch or a deleted user signs out. If the lookup itself
 * fails (e.g. a database timeout), the token is kept for this request: the
 * failure is logged, and a brief database problem doesn't sign everyone out.
 */
export async function checkSessionVersion<T extends { sub?: string | null; sv?: unknown }>(
  token: T,
  lookup: (userId: string) => Promise<number | null>,
): Promise<T | null> {
  if (!token.sub) return null;
  let current: number | null;
  try {
    current = await lookup(token.sub);
  } catch (err) {
    console.error("Session version lookup failed; keeping the session for this request", err);
    return token;
  }
  if (current === null || current !== token.sv) return null;
  return token;
}
