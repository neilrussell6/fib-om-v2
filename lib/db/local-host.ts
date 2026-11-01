/**
 * True only for an explicitly local database host. Those get a direct node-postgres
 * connection; any other host, including a misconfigured one, uses the Neon driver
 * with its secure defaults.
 */
export function isLocalDatabase(databaseUrl: string): boolean {
  const host = new URL(databaseUrl).hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host === "::1" ||
    host === "localtest.me" ||
    host.endsWith(".localtest.me")
  );
}
