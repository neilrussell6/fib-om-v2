// Row types, written by hand to match db/migrations (overview O5).

export type UserRow = {
  id: number;
  email: string;
  password_hash: string;
  created_at: Date;
};

export type LoginAttemptRow = {
  id: number;
  ip: string;
  attempted_at: Date;
};
