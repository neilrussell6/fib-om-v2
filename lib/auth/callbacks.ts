import { checkSessionVersion, type SessionUser } from "./session-version";

/**
 * The Auth.js callbacks (spec 01 session version, spec 09 P2), taking their user lookup
 * as a parameter so they can be unit tested without Auth.js. lib/auth.ts wires them up.
 */

type Token = { sub?: string | null; email?: string | null; name?: string | null; sv?: unknown; [key: string]: unknown };
type SignInUser = { id?: string; email?: string | null; name?: string | null; sessionVersion?: number };

/**
 * Sign-in stores the user's id, email, name and session version in the token. Every later
 * auth check (proxy, pages, Server Actions) re-checks the version and refreshes the name and
 * email in one query. Returning null makes Auth.js clear the cookie and treat the request as
 * signed out: sign-out and password changes bump the version, and deleted users lose access.
 */
export async function jwtCallback<T extends Token>(
  { token, user }: { token: T; user?: SignInUser | null },
  lookup: (userId: string) => Promise<SessionUser | null>,
): Promise<T | null> {
  if (user) {
    return { ...token, sub: user.id, email: user.email, name: user.name ?? null, sv: user.sessionVersion ?? 0 };
  }
  return checkSessionVersion(token, lookup);
}

/** Exposes the token's id, email and name on the session (the sidebar reads the name, spec 09). */
export function sessionCallback<S extends { user?: { id?: string; email?: string | null; name?: string | null } }>({
  session,
  token,
}: {
  session: S;
  token: Token;
}): S {
  if (session.user) {
    session.user.id = token.sub ?? "";
    session.user.email = token.email ?? "";
    session.user.name = token.name ?? null;
  }
  return session;
}
