import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Signed in via the saved session (storageState).

test("AC-9 the sidebar shows Dashboard with an icon, active on /", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: /main/i });
  const dashboard = nav.getByRole("link", { name: "Dashboard" });
  await expect(dashboard).toBeVisible();
  await expect(dashboard).toHaveAttribute("aria-current", "page");
  await expect(dashboard.locator("svg")).toHaveCount(1);
});

test("AC-10 below md the sidebar becomes a sheet, keyboard operable, closed by Escape", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: /main/i })).toBeHidden();
  const menu = page.getByRole("button", { name: /menu/i });
  await menu.focus();
  await page.keyboard.press("Enter");
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Dashboard" })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(sheet.locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});

test("AC-11 the document title contains Fibatron", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Fibatron/);
});

test("AC-12 palette variables are defined and the root font size is fixed", async ({ page }) => {
  await page.goto("/");
  const resolve = (v: string) =>
    page.evaluate((name) => {
      const probe = document.createElement("div");
      probe.style.color = `var(${name})`;
      document.body.appendChild(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    }, v);
  expect(await resolve("--primary")).toBe("rgb(7, 128, 176)");
  expect(await resolve("--secondary")).toBe("rgb(44, 44, 44)");
  expect(await resolve("--foreground")).toBe("rgb(103, 103, 103)");
  expect(await resolve("--sidebar")).toBe("rgb(142, 152, 155)");
  expect(await resolve("--sidebar-primary")).toBe("rgb(40, 78, 93)");
  expect(await resolve("--background")).toBe("rgb(255, 255, 255)");

  const rootSize = () => page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  await page.setViewportSize({ width: 375, height: 800 });
  const small = await rootSize();
  await page.setViewportSize({ width: 1920, height: 1080 });
  expect(await rootSize()).toBe(small);
});

for (const path of ["/", "/login"]) {
  test(`AC-13 axe finds no critical violations and no contrast failures on ${path}`, async ({ page, browser }) => {
    const target = path === "/login" ? await (await browser.newContext({ storageState: { cookies: [], origins: [] } })).newPage() : page;
    await target.goto(path);
    const results = await new AxeBuilder({ page: target }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations.filter((v) => v.impact === "critical")).toEqual([]);
    expect(results.violations.filter((v) => v.id === "color-contrast")).toEqual([]);
  });
}

test("Accessibility: every control in the shell has an accessible name", async ({ page }) => {
  await page.goto("/");
  const unnamed = await page.$$eval("button, a, input, select, textarea", (els) =>
    els.filter((el) => !(el.getAttribute("aria-label") || el.textContent?.trim() || (el as HTMLInputElement).labels?.length)).length,
  );
  expect(unnamed).toBe(0);
});
