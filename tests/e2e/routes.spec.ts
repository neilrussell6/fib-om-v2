import { expect, test } from "@playwright/test";

// AC-8: what proxy.ts leaves alone for an unauthenticated request.
test.describe("AC-8 public paths", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  // Spec 09 T E1: which paths redirect to /login is a unit test of proxy.ts's matcher and
  // handler (tests/unit/proxy-matcher.test.ts). Serving a built static asset stays here.
  test("a Next static asset is not redirected", async ({ page, request }) => {
    await page.goto("/login");
    const src = await page.locator('script[src^="/_next/static/"]').first().getAttribute("src");
    expect(src).toBeTruthy();
    const res = await request.get(src!, { maxRedirects: 0 });
    expect(res.status()).toBe(200);
  });
});

test("AC-19 page loads and the session endpoint are never refused by the sign-in limit", async ({ page, request }) => {
  // The saved session (storageState) is signed in; these requests are not sign-in attempts.
  for (let i = 0; i < 15; i++) {
    const res = await request.get("/api/auth/session");
    expect(res.status()).toBe(200);
  }
  for (let i = 0; i < 12; i++) {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  }
});
