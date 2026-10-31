import { expect, test } from "@playwright/test";
import { clearLoginAttempts, deleteUser } from "../helpers/test-db";
import { ensureTestUser, loginAlert, signIn, signInAndWait, TEST_USER, uniqueIp } from "./helpers";

// These tests are about signing in, so they start signed out and each uses its own client IP.
test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ context }) => {
  const ip = uniqueIp();
  await clearLoginAttempts(ip);
  await context.setExtraHTTPHeaders({ "x-real-ip": ip });
});

test("AC-2 unauthenticated / redirects to /login?callbackUrl=%2F", async ({ request }) => {
  const res = await request.get("/", { maxRedirects: 0 });
  expect([302, 303, 307, 308]).toContain(res.status());
  const location = new URL(res.headers()["location"], "http://x");
  expect(location.pathname).toBe("/login");
  expect(location.search).toBe("?callbackUrl=%2F");
});

test("AC-3 signing in lands on the Dashboard inside the app shell", async ({ page }) => {
  ensureTestUser();
  await page.goto("/");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2F$/);
  await signIn(page, TEST_USER.email, TEST_USER.password);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: /main/i })).toBeAttached();
  await expect(page.getByRole("banner")).toBeVisible();
});

test("AC-3 login page shows Fibatron on the background image", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Fibatron" })).toBeVisible();
  const bg = await page.locator("main").evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(bg).toContain("bg.jpg");
});

test("AC-4 an internal callbackUrl is honoured", async ({ page }) => {
  ensureTestUser();
  await page.goto("/login?callbackUrl=%2Fsome%2Finternal%2Fpath");
  await signIn(page, TEST_USER.email, TEST_USER.password);
  await expect(page).toHaveURL(/\/some\/internal\/path$/);
});

for (const bad of ["https://evil.example", "//evil.example", "javascript:alert(1)"]) {
  test(`AC-4 callbackUrl ${bad} lands on /`, async ({ page }) => {
    ensureTestUser();
    await page.goto(`/login?callbackUrl=${encodeURIComponent(bad)}`);
    await signIn(page, TEST_USER.email, TEST_USER.password);
    await expect(page).toHaveURL(/^http:\/\/[^/]+\/$/);
  });
}

test("AC-5 wrong password and unknown email show the same message", async ({ page }) => {
  ensureTestUser();
  await page.goto("/login");
  await signIn(page, TEST_USER.email, "definitely-wrong-123");
  const wrongPassword = loginAlert(page);
  await expect(wrongPassword).toHaveText("Email or password is incorrect");
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/login");
  await signIn(page, "nobody-here@example.com", "definitely-wrong-123");
  await expect(loginAlert(page)).toHaveText("Email or password is incorrect");
});

test("AC-5 email in a different case signs in", async ({ page }) => {
  ensureTestUser();
  await page.goto("/login");
  await signIn(page, "E2E-Staff@Example.com", TEST_USER.password);
  await expect(page).toHaveURL(/\/$/);
});

// Sign-out ends every session of that user (session version), so these tests use their
// own user rather than the shared e2e user whose saved session other tests reuse.
const SIGN_OUT_USER = { email: "e2e-signout@example.com", password: "signout-password-1" };

test("AC-7 the top bar shows the email, and sign-out ends the session", async ({ page }) => {
  ensureTestUser(SIGN_OUT_USER.email, SIGN_OUT_USER.password);
  await page.goto("/login");
  await signIn(page, SIGN_OUT_USER.email, SIGN_OUT_USER.password);
  await expect(page.getByRole("banner")).toContainText(SIGN_OUT_USER.email);
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2F$/);
});

test("Review 02: a session cookie issued before sign-out is rejected afterwards (late prefetch race)", async ({ page, context }) => {
  ensureTestUser(SIGN_OUT_USER.email, SIGN_OUT_USER.password);
  await page.goto("/login");
  await signIn(page, SIGN_OUT_USER.email, SIGN_OUT_USER.password);
  await expect(page).toHaveURL(/\/$/);
  // What a prefetch still in flight at sign-out would put back.
  const before = (await context.cookies()).find((c) => c.name === "authjs.session-token");
  expect(before).toBeDefined();
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login/);
  await context.addCookies([before!]);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2F$/);
});

test("AC-19 the 11th sign-in attempt in a minute is refused, without checking the password", async ({ page }) => {
  const email = "limit-test@example.com";
  ensureTestUser(email, "limit-password-123");
  await page.goto("/login");
  for (let i = 0; i < 10; i++) {
    await signInAndWait(page, email, `wrong-password-${i}x`);
    await expect(loginAlert(page)).toHaveText("Email or password is incorrect");
  }
  // Correct password, but the limit applies first.
  await signInAndWait(page, email, "limit-password-123");
  await expect(loginAlert(page)).toHaveText("Too many sign-in attempts. Try again in a minute.");
  await expect(page).toHaveURL(/\/login/);
  await deleteUser(email);
});
