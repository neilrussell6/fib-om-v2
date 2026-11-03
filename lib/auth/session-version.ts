/** The session check's view of a user (spec 09 P2): the current version and the name and email to show. */
export type SessionUser = { sessionVersion: number; name: string | null; email: string };

/**
 * Decides whether a session token is still valid against the user's current
 * session version (spec 01, session version). Returns the token, or null to
 * sign the request out. A valid token picks up the user's current name and
 * email (spec 09 P2), so a rename shows on the next request with no second query.
 *
 * Only a confirmed mismatch or a deleted user signs out. If the lookup itself
 * fails (e.g. a database timeout), the token is kept unchanged for this request:
 * the failure is logged, and a brief database problem doesn't sign everyone out.
 */
export async function checkSessionVersion<T extends { sub?: string | null; sv?: unknown }>(
  token: T,
  lookup: (userId: string) => Promise<SessionUser | null>,
): Promise<(T & { name?: string | null; email?: string | null }) | null> {
  if (!token.sub) return null;
  let current: SessionUser | null;
  try {
    current = await lookup(token.sub);
  } catch (err) {
    console.error("Session version lookup failed; keeping the session for this request", err);
    return token;
  }
  if (current === null || current.sessionVersion !== token.sv) return null;
  return { ...token, name: current.name, email: current.email };
}
