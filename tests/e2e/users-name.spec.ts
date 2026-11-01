import { expect, test } from "@playwright/test";
import { withDb } from "../helpers/test-db";
import { expectToast, fillField, save } from "./form-helpers";
import { TEST_USER } from "./helpers";

// Spec 06 AC-4 / AC-10: an optional user name, shown in the Users list and the sidebar footer.
const userId = () =>
  withDb(async (c) => Number((await c.query("SELECT id FROM users WHERE email = $1", [TEST_USER.email])).rows[0].id));

test.afterAll(() => withDb((c) => c.query("UPDATE users SET name = NULL WHERE email = $1", [TEST_USER.email])));

test("06 AC-10 / AC-4 set a name, see it in the list and sidebar; clear it and see the email", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const id = await userId();
  await page.goto(`/users/${id}/edit`);
  const name = page.getByLabel("Name", { exact: true }).filter({ visible: true });
  await expect(page.locator("form").getByRole("textbox").first()).toHaveAccessibleName("Name");
  await fillField(page, "Name", "Erin Example");
  await save(page);
  await expectToast(page, "User successfully updated");

  await page.goto(`/users?email=${encodeURIComponent(TEST_USER.email)}`);
  const row = page.getByRole("row").filter({ hasText: TEST_USER.email });
  await expect(row.getByRole("cell").first()).toHaveText("Erin Example");
  const user = page.getByTestId("sidebar-user");
  await expect(user).toContainText("Erin Example");
  await expect(user.getByTestId("avatar")).toHaveText("E");

  await page.goto(`/users/${id}/edit`);
  await name.fill("");
  await save(page);
  await expectToast(page, "User successfully updated");
  const stored = await withDb(async (c) => (await c.query("SELECT name FROM users WHERE id = $1", [id])).rows[0].name);
  expect(stored).toBeNull();
  await page.goto("/");
  await expect(page.getByTestId("sidebar-user")).toContainText(TEST_USER.email);
});
