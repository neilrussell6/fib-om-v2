import { neon, neonConfig, Pool, type PoolClient, types } from "@neondatabase/serverless";
import type { Pool as PgPool } from "pg";
import ws from "ws";
import { usesLocalProxy } from "./local-proxy";

/**
 * @neondatabase/serverless everywhere except `next dev`. On Neon it talks to
 * Neon's HTTP and WebSocket endpoints; in integration tests, e2e (`next start`)
 * and CI, DATABASE_URL points at a Neon-compatible proxy (local-neon-http-proxy)
 * in front of plain Postgres, so the deployed driver path stays tested.
 *
 * Under `next dev` against a local database, queries go straight to Postgres
 * with node-postgres instead: the local proxy re-authenticates and opens a new
 * connection for every query (~250 ms each). Set LOCAL_DB_VIA_PROXY=1 to use the
 * proxy in dev too.
 */
const LOCAL_PROXY_PORT = Number(process.env.LOCAL_NEON_PROXY_PORT ?? 4444);

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.tpl).");
  return url;
}

/** True only for `next dev` against an explicitly local host (never on Neon, in tests or in a build). */
export function usesDirectDevConnection(
  env: { NODE_ENV?: string; LOCAL_DB_VIA_PROXY?: string; DATABASE_URL?: string } = process.env,
): boolean {
  return (
    env.NODE_ENV === "development" &&
    env.LOCAL_DB_VIA_PROXY !== "1" &&
    !!env.DATABASE_URL &&
    usesLocalProxy(env.DATABASE_URL)
  );
}

let configured = false;
function configure(): void {
  if (configured) return;
  configured = true;
  neonConfig.webSocketConstructor = ws;
  // DATE columns stay as "YYYY-MM-DD" strings (no timezone shifts through JS Date).
  types.setTypeParser(types.builtins.DATE, (value: string) => value);
  if (usesLocalProxy(databaseUrl())) {
    neonConfig.fetchEndpoint = (host) => `http://${host}:${LOCAL_PROXY_PORT}/sql`;
    neonConfig.useSecureWebSocket = false;
    neonConfig.wsProxy = (host) => `${host}:${LOCAL_PROXY_PORT}/v2`;
    neonConfig.pipelineConnect = false;
  }
}

// Dev-only node-postgres pool, kept on globalThis so hot reloads don't open a new pool each time.
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
  if (usesDirectDevConnection()) {
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
  if (usesDirectDevConnection()) return (await (await devPool()).query(text, params)).rows as T[];
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

/** Runs fn inside a transaction on a pooled connection (WebSocket on Neon; node-postgres under `next dev`). */
export async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const conn = usesDirectDevConnection()
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
