import { sql } from "@/lib/db";
import type { UserRow } from "@/lib/db/types";

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const rows = await sql<UserRow>`
    SELECT id, email, password_hash, created_at FROM users WHERE email = ${email.trim().toLowerCase()}
  `;
  return rows[0] ?? null;
}

export class UserExistsError extends Error {
  constructor(email: string) {
    super(`A user with email ${email} already exists`);
  }
}

export async function createUser(email: string, passwordHash: string): Promise<UserRow> {
  const normalised = email.trim().toLowerCase();
  try {
    const rows = await sql<UserRow>`
      INSERT INTO users (email, password_hash) VALUES (${normalised}, ${passwordHash})
      RETURNING id, email, password_hash, created_at
    `;
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
