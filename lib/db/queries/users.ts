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
