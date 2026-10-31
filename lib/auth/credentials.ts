import bcrypt from "bcryptjs";
import { emailSchema } from "@/lib/validation/auth";
import type { UserRow } from "@/lib/db/types";

/**
 * A fixed bcrypt hash of a random value nobody knows. Unknown emails are
 * compared against it so a failed login takes the same time whether or not
 * the email exists.
 */
const DUMMY_HASH = "$2b$12$vV5pTWLw.BmYWvC6rII.COnJoVCh2YzEofbuDn4x68/CYysJoIiFe";

type Deps = {
  findUserByEmail: (email: string) => Promise<(Pick<UserRow, "id" | "email" | "password_hash"> & { session_version?: number }) | null>;
};

export async function verifyCredentials(
  input: { email?: unknown; password?: unknown },
  { findUserByEmail }: Deps,
): Promise<{ id: string; email: string; sessionVersion: number } | null> {
  const email = emailSchema.safeParse(input.email);
  const password = typeof input.password === "string" ? input.password : "";
  if (!email.success || !password) {
    await bcrypt.compare(password || "x", DUMMY_HASH);
    return null;
  }
  const user = await findUserByEmail(email.data);
  const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) return null;
  return { id: String(user.id), email: user.email, sessionVersion: Number(user.session_version ?? 0) };
}
