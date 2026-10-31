import { neon, neonConfig, Pool, type PoolClient } from "@neondatabase/serverless";
import ws from "ws";

/**
 * One driver everywhere: @neondatabase/serverless. On Neon it talks to Neon's
 * HTTP and WebSocket endpoints; locally and in CI, DATABASE_URL points at a
 * Neon-compatible proxy (local-neon-http-proxy) in front of plain Postgres.
 */
const LOCAL_PROXY_PORT = Number(process.env.LOCAL_NEON_PROXY_PORT ?? 4444);

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.tpl).");
  return url;
}

function isNeonHost(url: string): boolean {
  return new URL(url).hostname.endsWith(".neon.tech");
}

let configured = false;
function configure(): void {
  if (configured) return;
  configured = true;
  neonConfig.webSocketConstructor = ws;
  if (!isNeonHost(databaseUrl())) {
    neonConfig.fetchEndpoint = (host) => `http://${host}:${LOCAL_PROXY_PORT}/sql`;
    neonConfig.useSecureWebSocket = false;
    neonConfig.wsProxy = (host) => `${host}:${LOCAL_PROXY_PORT}/v2`;
    neonConfig.pipelineConnect = false;
  }
}

let httpClient: ReturnType<typeof neon> | undefined;
function client(): ReturnType<typeof neon> {
  configure();
  httpClient ??= neon(databaseUrl());
  return httpClient;
}

/** Tagged-template SQL over HTTP. Values become $n parameters. */
export function sql<T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
  return client()(strings, ...values) as unknown as Promise<T[]>;
}

let pool: Pool | undefined;
export function getPool(): Pool {
  configure();
  pool ??= new Pool({ connectionString: databaseUrl() });
  return pool;
}

/** Runs fn inside a transaction on a pooled (WebSocket) connection. */
export async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const conn = await getPool().connect();
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
