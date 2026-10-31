import { expect, test } from "@playwright/test";
import { decode, encode } from "next-auth/jwt";
import { withDb } from "../helpers/test-db";
import { SESSION_COOKIE, TEST_USER, uniqueIp } from "./helpers";

const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET must be set for the e2e tests (same value as the app server).");
  return s;
};

/** A session token for the e2e user, carrying its current session version (checked on every request). */
async function cookieFor(maxAgeSeconds: number): Promise<string> {
  const user = await withDb(async (c) =>
    (await c.query("SELECT id, session_version FROM users WHERE email = $1", [TEST_USER.email])).rows[0],
  );
  return encode({
    token: { sub: String(user.id), email: TEST_USER.email, sv: Number(user.session_version) },
    secret: secret(),
    salt: SESSION_COOKIE,
    maxAge: maxAgeSeconds,
  });
}

// AC-6: JWT session cookie, 8-hour rolling lifetime.
test.describe("AC-6 session lifetime", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("an expired session is rejected", async ({ request, baseURL }) => {
    const token = await cookieFor(-60);
    const res = await request.get("/", {
      maxRedirects: 0,
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
    });
    expect([302, 303, 307, 308]).toContain(res.status());
    expect(res.headers()["location"]).toContain("/login");
    expect(baseURL).toBeTruthy();
  });

  test("a request near the end of the session rolls it forward to 8 hours", async ({ request }) => {
    const token = await cookieFor(60); // about to expire
    const res = await request.get("/", {
      maxRedirects: 0,
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
    });
    expect(res.status()).toBe(200);
    const setCookie = res.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie" && h.value.startsWith(`${SESSION_COOKIE}=`));
    expect(setCookie.length).toBeGreaterThan(0);
    const fresh = setCookie[0].value.split(";")[0].slice(SESSION_COOKIE.length + 1);
    const payload = await decode({ token: fresh, secret: secret(), salt: SESSION_COOKIE });
    const now = Math.floor(Date.now() / 1000);
    expect(payload?.exp).toBeGreaterThan(now + 7.9 * 3600);
    expect(payload?.exp).toBeLessThanOrEqual(now + 8 * 3600 + 5);
  });

  test("a real sign-in stores the session as a JWT cookie", async ({ page, context }) => {
    await context.setExtraHTTPHeaders({ "x-real-ip": uniqueIp() });
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByLabel("Password").fill(TEST_USER.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/$/);
    const cookie = (await context.cookies()).find((c) => c.name === SESSION_COOKIE);
    expect(cookie).toBeDefined();
    expect(cookie!.httpOnly).toBe(true);
    const payload = await decode({ token: cookie!.value, secret: secret(), salt: SESSION_COOKIE });
    expect(payload?.email).toBe(TEST_USER.email);
  });
});
