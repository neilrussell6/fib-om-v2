/**
 * Paths that never require a session: the login page, Auth.js endpoints,
 * Next.js assets, files in public/, and the notcher feed (protected by its own key).
 */
export function isPublicPath(pathname: string): boolean {
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;
  if (pathname.startsWith("/api/auth/") || pathname === "/api/auth") return true;
  if (pathname === "/vw-notcher-api") return true;
  if (pathname.startsWith("/_next/")) return true;
  // Files served from public/ (and favicon.ico) have an extension in their last segment.
  return /\/[^/]+\.[a-z0-9]+$/i.test(pathname);
}
