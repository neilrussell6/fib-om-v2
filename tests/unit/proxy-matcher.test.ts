import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { isPublicPath } from "@/lib/auth/public-paths";

// Spec 09 T E1 (moved down from e2e routes.spec, spec 01 AC-8): which requests proxy.ts sends to
// /login. The matcher is checked with Next's own matcher test helper (installed name
// unstable_doesMiddlewareMatch; the proxy docs call it unstable_doesProxyMatch), and the
// handler is called directly. Auth.js is mocked so `auth(handler)` is the handler itself.
vi.mock("@/lib/auth", () => ({ auth: (handler: unknown) => handler }));

const load = () => import("@/proxy");

/** Whether an unauthenticated request to `path` is sent to /login. */
async function redirectsToLogin(path: string): Promise<boolean> {
  const { config } = await load();
  if (!unstable_doesMiddlewareMatch({ config, url: path })) return false;
  return !isPublicPath(path);
}

describe("spec 01 AC-8 public paths (proxy matcher)", () => {
  it.each(["/login", "/api/auth/session", "/api/auth/csrf", "/favicon.ico", "/bg.jpg", "/vw-notcher-api"])(
    "%s is not redirected to /login",
    async (path) => {
      expect(await redirectsToLogin(path)).toBe(false);
    },
  );

  it.each(["/orders", "/users/1/edit"])("%s redirects to /login", async (path) => {
    expect(await redirectsToLogin(path)).toBe(true);
  });

  it("the matcher skips Auth.js, the notcher feed and Next's static assets", async () => {
    const { config } = await load();
    for (const url of ["/api/auth/session", "/vw-notcher-api", "/_next/static/chunks/main.js", "/_next/image", "/favicon.ico"]) {
      expect(unstable_doesMiddlewareMatch({ config, url }), url).toBe(false);
    }
    for (const url of ["/", "/orders", "/vw-notcher-api-other", "/api/other"]) {
      expect(unstable_doesMiddlewareMatch({ config, url }), url).toBe(true);
    }
  });
});

describe("spec 01 AC-2 the proxy handler", () => {
  const call = async (url: string, signedIn: boolean) => {
    const { default: handler } = (await load()) as unknown as { default: (req: NextRequest & { auth: unknown }) => Response | undefined };
    const req = Object.assign(new NextRequest(url), { auth: signedIn ? { user: { id: "1" } } : null });
    return handler(req);
  };

  it("sends a signed-out request to /login with the path and query as callbackUrl", async () => {
    const res = await call("http://localhost/orders?client=3", false);
    expect(res?.status).toBe(307);
    const location = new URL(res!.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("callbackUrl")).toBe("/orders?client=3");
  });

  it("lets a signed-in request and a public path through", async () => {
    expect(await call("http://localhost/orders", true)).toBeUndefined();
    expect(await call("http://localhost/login", false)).toBeUndefined();
  });
});
