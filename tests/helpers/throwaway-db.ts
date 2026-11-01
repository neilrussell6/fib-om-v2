// Test-only: a throwaway database, created on the server in DATABASE_URL_UNPOOLED and
// migrated with Atlas, for tests that empty whole tables (seed-dummy). Never the shared
// test database the other integration tests use.
import { spawnSync } from "node:child_process";
import pg from "pg";
import { directDatabaseUrl } from "./test-db";

export type ThrowawayDb = {
  url: string;
  drop: () => Promise<void>;
};

function withDatabase(url: string, name: string): string {
  const u = new URL(url);
  u.pathname = `/${name}`;
  return u.toString();
}

async function admin<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = new pg.Client({ connectionString: directDatabaseUrl() });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

export async function createThrowawayDb(): Promise<ThrowawayDb> {
  const which = spawnSync("atlas", ["version"], { encoding: "utf8" });
  if (which.error || which.status !== 0) {
    throw new Error("atlas not found: install with curl -sSf https://atlasgo.sh | sh");
  }

  const name = `seed_dummy_test_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await admin((c) => c.query(`CREATE DATABASE ${name}`));
  const url = withDatabase(directDatabaseUrl(), name);

  const drop = () => admin((c) => c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`)).then(() => undefined);

  const migrate = spawnSync(
    "atlas",
    ["migrate", "apply", "--dir", "file://db/migrations", "--url", url, "--revisions-schema", "public"],
    { encoding: "utf8" },
  );
  if (migrate.status !== 0) {
    await drop();
    throw new Error(`atlas migrate apply failed:\n${migrate.stdout}\n${migrate.stderr}`);
  }
  return { url, drop };
}

/** Runs fn with a client on the given database, closing it afterwards. */
export async function withUrl<T>(url: string, fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}
