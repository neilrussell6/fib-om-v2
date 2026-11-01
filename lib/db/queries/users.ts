import { query, type Queryable, sql } from "@/lib/db";
import type { UserRow } from "@/lib/db/types";

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const rows = await sql<UserRow>`
    SELECT id, email, password_hash, session_version, created_at FROM users WHERE email = ${email.trim().toLowerCase()}
  `;
  return rows[0] ?? null;
}

/** The user's current session version, or null if the user no longer exists. */
export async function getSessionVersion(userId: number | string): Promise<number | null> {
  if (!/^\d+$/.test(String(userId))) return null;
  const rows = await sql<{ session_version: number }>`SELECT session_version FROM users WHERE id = ${userId}`;
  return rows[0] ? Number(rows[0].session_version) : null;
}

/** Invalidates every session the user holds (sign-out, password change). */
export async function bumpSessionVersion(userId: number | string): Promise<void> {
  await sql`UPDATE users SET session_version = session_version + 1 WHERE id = ${userId}`;
}

export class UserExistsError extends Error {
  constructor(email: string) {
    super(`A user with email ${email} already exists`);
  }
}

/** Inserts a user; `db` is the app's connection unless a script passes its own client. */
export async function createUser(email: string, passwordHash: string, db?: Queryable): Promise<UserRow> {
  const normalised = email.trim().toLowerCase();
  try {
    const text = `INSERT INTO users (email, password_hash) VALUES ($1, $2)
      RETURNING id, email, password_hash, session_version, created_at`;
    const rows = db
      ? ((await db.query(text, [normalised, passwordHash])).rows as UserRow[])
      : await query<UserRow>(text, [normalised, passwordHash]);
    return rows[0];
  } catch (err) {
    if ((err as { code?: string }).code === "23505") throw new UserExistsError(normalised);
    throw err;
  }
}

/**
 * Spec 02: you can't delete your own account, and the last remaining user
 * can't be deleted. Runs on the given client so callers can wrap it in a
 * transaction (the count and the delete must see the same state).
 */
export async function deleteUserChecked(
  db: { query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> },
  targetId: number | string,
  currentUserId: number | string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (String(targetId) === String(currentUserId)) return { ok: false, error: "You can't delete your own account" };
  // Lock the users table rows so two concurrent deletes can't both pass the count.
  const { rows } = await db.query("SELECT id FROM users FOR UPDATE");
  if (rows.length <= 1) return { ok: false, error: "Can't delete the last user" };
  await db.query("DELETE FROM users WHERE id = $1", [targetId]);
  return { ok: true };
}

/** The sidebar footer's name and email for a user (spec 06), or null for an unknown id. */
export async function getUserDisplay(userId: number | string): Promise<{ name: string | null; email: string } | null> {
  if (!/^\d+$/.test(String(userId))) return null;
  const rows = await sql<{ name: string | null; email: string }>`SELECT name, email FROM users WHERE id = ${userId}`;
  return rows[0] ?? null;
}
