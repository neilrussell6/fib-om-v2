// Row types, written by hand to match db/migrations (overview O5).

export type UserRow = {
  id: number;
  /** Optional display name (spec 06). */
  name?: string | null;
  email: string;
  password_hash: string;
  /** Incremented on sign-out (and password change); sessions carrying an older value are rejected. */
  session_version: number;
  created_at: Date;
};

export type LoginAttemptRow = {
  id: number;
  ip: string;
  attempted_at: Date;
};
