import { expect, test } from "@playwright/test";
import { createFixture, type Fixture, removeFixture } from "../helpers/fixtures";
import { clearLoginAttempts, withDb } from "../helpers/test-db";
import { expectToast, fillField, save } from "./form-helpers";
import { loginAlert, signIn, TEST_USER, uniqueIp } from "./helpers";

let fx: Fixture;
test.beforeAll(async () => {
  fx = await createFixture();
  await withDb(async (c) => {
    for (let i = 0; i < 30; i++) await c.query("INSERT INTO product_sizes (name) VALUES ($1)", [`${fx.tag} combo ${i}`]);
  });
});
test.afterAll(() => removeFixture(fx.tag));

test("AC-22 a user created on the Users screen can sign in; no page shows a password or hash", async ({ page, browser }) => {
  const email = `${fx.tag}-newuser@example.com`;
  await page.goto("/users/new");
  await fillField(page, "Email", email);
  await fillField(page, "Password", "screen-password-1");
  await save(page);
  await expectToast(page, "User successfully created");
  const id = await withDb(async (c) => Number((await c.query("SELECT id FROM users WHERE email = $1", [email])).rows[0].id));
  for (const path of [`/users/${id}`, `/users/${id}/edit`, `/users?email=${fx.tag}`]) {
    await page.goto(path);
    const html = await page.content();
    expect(html, path).not.toMatch(/\$2[aby]\$\d\d\$/);
    expect(html, path).not.toContain("screen-password-1");
  }
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  await page.goto(`/users/${id}/edit`);
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");

  const ip = uniqueIp();
  await clearLoginAttempts(ip);
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, extraHTTPHeaders: { "x-real-ip": ip } });
  const p2 = await ctx.newPage();
  await p2.goto("/login");
  await signIn(p2, email, "screen-password-1");
  await expect(p2).toHaveURL(/\/$/);
  await expect(loginAlert(p2)).toHaveCount(0);
  await ctx.close();
});

test("AC-34 you can't delete your own account", async ({ page }) => {
  const id = await withDb(async (c) => Number((await c.query("SELECT id FROM users WHERE email = $1", [TEST_USER.email])).rows[0].id));
  await page.goto(`/users/${id}/edit`);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
  await expectToast(page, "Could not delete User: You can't delete your own account");
});

test("AC-12 reference comboboxes: debounced server search, at most 25 options, keyboard only", async ({ page }) => {
  const searches: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/reference/product_sizes")) searches.push(r.url());
  });
  await page.goto("/products/new");
  const combo = page.getByRole("combobox", { name: "Size", exact: true });
  await combo.focus();
  await page.keyboard.press("Enter");
  const input = page.getByPlaceholder("Search…");
  await expect(input).toBeFocused();
  searches.length = 0;
  await input.pressSequentially(`${fx.tag} combo`, { delay: 20 });
  await expect(page.getByRole("option")).toHaveCount(25);
  expect(searches.length).toBeLessThanOrEqual(2);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(combo).toContainText(`${fx.tag} combo`);
  await combo.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByPlaceholder("Search…")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByPlaceholder("Search…")).toBeHidden();
});
