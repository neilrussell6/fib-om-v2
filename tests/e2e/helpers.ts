import { spawnSync } from "node:child_process";
import { expect, type Page } from "@playwright/test";

export const TEST_USER = {
  email: "e2e-staff@example.com",
  password: "e2e-password-123",
};

/** Creates the e2e user with the real create-user script (ignores "already exists"). */
export function ensureTestUser(email = TEST_USER.email, password = TEST_USER.password): void {
  const r = spawnSync("npx", ["tsx", "scripts/create-user.ts", email], {
    env: { ...process.env, CREATE_USER_PASSWORD: password },
    input: "",
    encoding: "utf8",
    timeout: 60_000,
  });
  if (r.status !== 0 && !/exists/i.test(`${r.stdout}${r.stderr}`)) {
    throw new Error(`create-user failed: ${r.stderr || r.stdout}`);
  }
}

export async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
}

/**
 * Submits the login form and waits for that attempt's reply. Needed when several
 * attempts show the same message, so an assertion can't pass on the previous one.
 */
export async function signInAndWait(page: Page, email: string, password: string): Promise<void> {
  const reply = page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/login");
  await signIn(page, email, password);
  await reply;
  await expect(page.getByRole("button", { name: /sign in/i })).toBeEnabled();
}

/** A unique client IP per test, so tests never share a sign-in limit bucket. */
export function uniqueIp(): string {
  const n = Math.floor(Math.random() * 250) + 1;
  const m = Math.floor(Math.random() * 250) + 1;
  return `203.0.${n}.${m}`;
}

/** Auth.js session cookie name over plain http (local and CI). */
export const SESSION_COOKIE = "authjs.session-token";

/** The login form's error message. Scoped to the form because Next.js renders its own
 * route announcer with role="alert" on every page. */
export function loginAlert(page: Page) {
  return page.locator("form").getByRole("alert");
}
