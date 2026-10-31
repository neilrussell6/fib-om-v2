import { describe, expect, it } from "vitest";

// AC-8: paths that proxy.ts must never redirect to /login.
describe("AC-8 isPublicPath", () => {
  const load = () => import("@/lib/auth/public-paths");

  it.each([
    "/login",
    "/api/auth/session",
    "/api/auth/csrf",
    "/api/auth/signout",
    "/vw-notcher-api",
    "/_next/static/chunks/main.js",
    "/_next/image",
    "/favicon.ico",
    "/bg.jpg",
  ])("%s is public", async (path) => {
    const { isPublicPath } = await load();
    expect(isPublicPath(path)).toBe(true);
  });

  it.each(["/", "/orders", "/users/1/edit", "/vw-notcher-api-other", "/loginx", "/api/other"])(
    "%s needs a session",
    async (path) => {
      const { isPublicPath } = await load();
      expect(isPublicPath(path)).toBe(false);
    },
  );
});
