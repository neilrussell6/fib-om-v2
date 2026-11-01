import { neon, neonConfig, Pool, type PoolClient, types } from "@neondatabase/serverless";
import type { Pool as PgPool } from "pg";
import ws from "ws";
import { isLocalDatabase } from "./local-host";

/**
 * @neondatabase/serverless on Neon (its HTTP and WebSocket endpoints).
 *
 * Against a local database (dev, integration tests, e2e and CI) queries go straight
 * to Postgres with node-postgres. (A local Neon-compatible proxy was tried and dropped:
 * it re-authenticated on every query, ~200-350 ms each.)
 */

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.tpl).");
  return url;
}

/** True for an explicitly local database host (never for Neon). */
export function usesDirectConnection(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (
    !!env.DATABASE_URL &&
    isLocalDatabase(env.DATABASE_URL)
  );
}

let configured = false;
function configure(): void {
  if (configured) return;
  configured = true;
  neonConfig.webSocketConstructor = ws;
  // DATE columns stay as "YYYY-MM-DD" strings (no timezone shifts through JS Date).
  types.setTypeParser(types.builtins.DATE, (value: string) => value);
}

// node-postgres pool for a local database, kept on globalThis so dev hot reloads don't open a new pool each time.
const devGlobal = globalThis as typeof globalThis & { __fibDevPool?: Promise<PgPool> };
function devPool(): Promise<PgPool> {
  devGlobal.__fibDevPool ??= import("pg").then((mod) => {
    const pg = (mod as unknown as { default?: typeof mod }).default ?? mod;
    pg.types.setTypeParser(pg.types.builtins.DATE, (value: string) => value);
    return new pg.Pool({ connectionString: databaseUrl(), max: 10 });
  });
  return devGlobal.__fibDevPool;
}

let httpClient: ReturnType<typeof neon> | undefined;
function client(): ReturnType<typeof neon> {
  configure();
  httpClient ??= neon(databaseUrl());
  return httpClient;
}

/** Tagged-template SQL over HTTP. Values become $n parameters. */
export function sql<T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
  if (usesDirectConnection()) {
    const text = strings.reduce((acc, part, i) => `${acc}$${i}${part}`);
    return query<T>(text, values);
  }
  return client()(strings, ...values) as unknown as Promise<T[]>;
}

/**
 * A parameterised query from a SQL string. Only for SQL built from code constants
 * (allowlisted identifiers); every value goes in params as $n.
 */
export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  if (usesDirectConnection()) return (await (await devPool()).query(text, params)).rows as T[];
  return (await client().query(text, params)) as unknown as T[];
}

/** Anything that can run a parameterised query: a pooled client inside tx(), or the HTTP client. */
export type Queryable = { query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };

let pool: Pool | undefined;
export function getPool(): Pool {
  configure();
  pool ??= new Pool({ connectionString: databaseUrl() });
  return pool;
}

/** Runs fn inside a transaction on a pooled connection (WebSocket on Neon; node-postgres locally). */
export async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const conn = usesDirectConnection()
    ? ((await (await devPool()).connect()) as unknown as PoolClient)
    : await getPool().connect();
  try {
    await conn.query("BEGIN");
    const result = await fn(conn);
    await conn.query("COMMIT");
    return result;
  } catch (err) {
    await conn.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}
