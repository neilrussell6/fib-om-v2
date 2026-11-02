import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { createFixture, type Fixture, removeFixture } from "../helpers/fixtures";
import { withDb } from "../helpers/test-db";

// Signed in via the saved session (storageState). Spec 06 AC-1 – AC-7 (supersedes spec 01 AC-9 and AC-12).

let fx: Fixture;
test.beforeAll(async () => {
  fx = await createFixture();
});
test.afterAll(() => removeFixture(fx.tag));

// While the streamed sidebar replaces its Suspense fallback, a hidden copy is briefly in the DOM.
const sidebar = (page: Page) => page.getByTestId("sidebar").filter({ visible: true });
const sidebarWidth = (page: Page) => sidebar(page).evaluate((el) => Math.round(el.getBoundingClientRect().width));

test("06 AC-1 IBM Plex Sans for text, IBM Plex Mono for order numbers, fonts served from the app", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (r) => {
    if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) external.push(r.url());
  });
  await page.goto(`/order-items?order=${fx.orderId}`);
  const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(bodyFont).toMatch(/IBM Plex Sans/i);
  const orderCell = page.getByRole("link", { name: fx.names.orderNumber, exact: true });
  expect(await orderCell.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/IBM Plex Mono/i);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => [...document.fonts].some((f) => /IBM Plex Sans/i.test(f.family) && f.status === "loaded"))).toBe(true);
  expect(external).toEqual([]);
});

test("06 AC-2 palette variables match the design, and the root font size is fixed", async ({ page }) => {
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
  expect(await resolve("--foreground")).toBe("rgb(29, 35, 38)");
  expect(await resolve("--muted-foreground")).toBe("rgb(94, 104, 109)");
  expect(await resolve("--subtle-foreground")).toBe("rgb(105, 113, 117)");
  expect(await resolve("--primary")).toBe("rgb(15, 85, 102)");
  expect(await resolve("--border")).toBe("rgb(228, 231, 232)");
  expect(await resolve("--input")).toBe("rgb(211, 216, 218)");
  expect(await resolve("--sidebar")).toBe("rgb(243, 245, 245)");
  expect(await resolve("--surface")).toBe("rgb(250, 251, 251)");
  expect(await resolve("--row-selected")).toBe("rgb(238, 245, 246)");
  expect(await resolve("--background")).toBe("rgb(255, 255, 255)");

  const rootSize = () => page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  await page.setViewportSize({ width: 375, height: 800 });
  const small = await rootSize();
  await page.setViewportSize({ width: 1920, height: 1080 });
  expect(await rootSize()).toBe(small);
});

test("06 AC-3 grouped sidebar with icons and the active item; no top bar", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/order-items");
  const nav = page.getByRole("navigation", { name: "Main" });
  for (const g of ["Operations", "Catalogue", "Admin"]) await expect(nav.getByText(g, { exact: true })).toBeVisible();
  const labels = (await nav.getByRole("link").allTextContents()).map((t) => t.trim());
  expect(labels).toEqual([
    "Dashboard", "Orders", "Order Items", "Delivery Dockets", "Products", "Product Categories",
    "Product Types", "Product Sizes", "Product Media", "Clients", "Users",
  ]);
  const active = nav.getByRole("link", { name: "Order Items" });
  await expect(active).toHaveAttribute("aria-current", "page");
  expect(await active.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(15, 85, 102)");
  await expect(active.locator("svg")).toHaveCount(1);
  await expect(page.getByRole("banner")).toBeHidden();
});

test("06 AC-4 the sidebar footer shows the avatar, the email fallback and Sign out", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const user = page.getByTestId("sidebar-user");
  await expect(user).toContainText("e2e-staff@example.com"); // the shared e2e user has no name
  await expect(user.getByTestId("avatar")).toHaveText("E");
  await expect(user.getByRole("button", { name: "Sign out" })).toBeVisible();
});

test("06 AC-5 the sidebar collapses to icons, keeps names, and remembers the choice", async ({ page, context }) => {
  await context.clearCookies({ name: "sidebar" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  // A single read can land mid-swap (fallback → streamed sidebar); poll until it settles.
  await expect.poll(() => sidebarWidth(page)).toBe(232);
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect.poll(() => sidebarWidth(page)).toBe(64);
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByText("Orders", { exact: true })).toBeHidden();
  await expect(nav.getByRole("link", { name: "Orders" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Orders" })).toHaveAttribute("title", "Orders");
  await page.reload();
  // A single read can land mid-swap (fallback → streamed sidebar); poll until it settles.
  await expect.poll(() => sidebarWidth(page)).toBe(64);
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect.poll(() => sidebarWidth(page)).toBe(232);
});

test("06 AC-5 with no cookie: open at 1440px, collapsed at 1024px, and no width change during load", async ({ page, context }) => {
  await context.clearCookies({ name: "sidebar" });
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto("/");
  // A single read can land mid-swap (fallback → streamed sidebar); poll until it settles.
  await expect.poll(() => sidebarWidth(page)).toBe(64);

  await page.setViewportSize({ width: 1440, height: 900 });
  // Record the sidebar's width from the very first paint until the page has loaded.
  await page.addInitScript(() => {
    const w = window as unknown as { __widths: number[] };
    w.__widths = [];
    const sample = () => {
      const el = document.querySelector('[data-testid="sidebar"]');
      if (el) w.__widths.push(Math.round(el.getBoundingClientRect().width));
      if (document.readyState !== "complete" || w.__widths.length < 5) requestAnimationFrame(sample);
    };
    new MutationObserver(sample).observe(document, { childList: true, subtree: true });
    requestAnimationFrame(sample);
  });
  await page.goto("/");
  await page.waitForLoadState("load");
  const widths = await page.evaluate(() => (window as unknown as { __widths: number[] }).__widths);
  expect(widths.length).toBeGreaterThan(0);
  expect(new Set(widths)).toEqual(new Set([232]));
});

test("06 AC-6 below 768px the grouped navigation opens in a sheet, keyboard operable, closed by Escape", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  await expect(page.getByTestId("sidebar").filter({ visible: true })).toHaveCount(0);
  const menu = page.getByRole("button", { name: /menu/i });
  await menu.focus();
  await page.keyboard.press("Enter");
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("Operations", { exact: true })).toBeVisible();
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

const AXE_PAGES = [
  "/",
  "/users",
  "/clients",
  "/products",
  "/product-categories",
  "/product-types",
  "/product-sizes",
  "/product-media",
  "/orders",
  "/order-items",
  "/delivery-dockets",
  "/order-items/new",
  "/login",
];
for (const path of AXE_PAGES) {
  test(`06 AC-7 axe finds no critical violations and no contrast failures on ${path}`, async ({ page, browser }) => {
    const target = path === "/login" ? await (await browser.newContext({ storageState: { cookies: [], origins: [] } })).newPage() : page;
    await target.goto(path);
    const results = await new AxeBuilder({ page: target }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations.filter((v) => v.impact === "critical")).toEqual([]);
    expect(results.violations.filter((v) => v.id === "color-contrast")).toEqual([]);
  });
}

test("06 AC-7 axe on /order-items with the panel open", async ({ page }) => {
  await page.goto(`/order-items?item=${fx.orderItemId}`);
  await expect(page.getByRole("region", { name: "Edit order item" })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations.filter((v) => v.impact === "critical")).toEqual([]);
  expect(results.violations.filter((v) => v.id === "color-contrast")).toEqual([]);
});

test("07 AC-15 axe on the Orders, Delivery Dockets, Product Categories and Users panels", async ({ page }) => {
  const userId = await withDb(async (c) => (await c.query("SELECT id FROM users WHERE email = 'e2e-staff@example.com'")).rows[0].id);
  for (const [path, id, region] of [
    ["/orders", fx.orderId, "Edit order"],
    ["/delivery-dockets", fx.docketId, "Edit delivery docket"],
    ["/product-categories", fx.categoryId, "Edit product category"],
    ["/users", userId, "Edit user"],
  ] as const) {
    await page.goto(`${path}?item=${id}`);
    await expect(page.getByRole("region", { name: region })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations.filter((v) => v.impact === "critical"), path).toEqual([]);
    expect(results.violations.filter((v) => v.id === "color-contrast"), path).toEqual([]);
  }
});

test("Accessibility: every control in the shell has an accessible name", async ({ page }) => {
  await page.goto("/");
  const unnamed = await page.$$eval("button, a, input, select, textarea", (els) =>
    els.filter((el) => !(el.getAttribute("aria-label") || el.textContent?.trim() || el.getAttribute("title") || (el as HTMLInputElement).labels?.length)).length,
  );
  expect(unnamed).toBe(0);
});
