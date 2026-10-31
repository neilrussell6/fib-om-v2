import { expect, test as setup } from "@playwright/test";
import { ensureSenderClient } from "../helpers/fixtures";
import { clearLoginAttempts } from "../helpers/test-db";
import { ensureTestUser, signIn, TEST_USER, uniqueIp } from "./helpers";

// Signs in once and saves the session; every other test reuses it, so the
// sign-in limit (AC-19) never trips the suite.
setup("sign in once and save the session", async ({ browser }) => {
  ensureTestUser();
  // Docket creation stamps the sender client from FROM_CLIENT_ID (spec 02); it must exist.
  await ensureSenderClient();
  const ip = uniqueIp();
  await clearLoginAttempts(ip);
  const context = await browser.newContext({ extraHTTPHeaders: { "x-real-ip": ip } });
  const page = await context.newPage();
  await page.goto("/login");
  await signIn(page, TEST_USER.email, TEST_USER.password);
  await expect(page).toHaveURL(/\/$/);
  await context.storageState({ path: "tests/e2e/.auth/user.json" });
  await context.close();
});
