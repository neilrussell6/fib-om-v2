/**
 * Local-proxy mode (plain http and unencrypted WebSockets to local-neon-http-proxy)
 * is only ever used for explicitly local hosts. Any other host, including a
 * misconfigured one, keeps the driver's secure defaults.
 */
export function usesLocalProxy(databaseUrl: string): boolean {
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
