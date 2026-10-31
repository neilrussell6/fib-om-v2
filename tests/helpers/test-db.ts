// Test-only database helper: a direct (non-proxied) Postgres connection for
// arranging and inspecting state. The app itself always goes through lib/db.
import pg from "pg";

export function directDatabaseUrl(): string {
  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url) {
    throw new Error(
      "DATABASE_URL_UNPOOLED is not set. Start the local database (docker compose up -d), run `npm run db:migrate`, and copy .env.tpl to .env.",
    );
  }
  return url;
}

export async function withDb<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: directDatabaseUrl() });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function clearLoginAttempts(ip?: string): Promise<void> {
  await withDb(async (c) => {
    if (ip) await c.query("DELETE FROM login_attempts WHERE ip = $1", [ip]);
    else await c.query("DELETE FROM login_attempts");
  });
}

export async function deleteUser(email: string): Promise<void> {
  await withDb((c) => c.query("DELETE FROM users WHERE email = $1", [email.toLowerCase()]));
}

export async function getUser(
  email: string,
): Promise<{ id: number; email: string; password_hash: string } | undefined> {
  return withDb(async (c) => {
    const r = await c.query("SELECT id, email, password_hash FROM users WHERE email = $1", [
      email.toLowerCase(),
    ]);
    return r.rows[0];
  });
}
