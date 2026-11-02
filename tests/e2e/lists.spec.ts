import { expect, test } from "@playwright/test";
import { createFixture, type Fixture, removeFixture } from "../helpers/fixtures";
import { withDb } from "../helpers/test-db";

let fx: Fixture;
test.beforeAll(async () => {
  fx = await createFixture();
  await withDb(async (c) => {
    for (let i = 0; i < 30; i++) await c.query("INSERT INTO product_sizes (name) VALUES ($1)", [`${fx.tag} sz ${String(i).padStart(2, "0")}`]);
  });
});
test.afterAll(() => removeFixture(fx.tag));

const headers = (page: import("@playwright/test").Page) =>
  page.getByRole("columnheader").evaluateAll((els) => els.map((e) => e.textContent?.trim()).filter((t) => t && t !== "Actions"));

// AC-6: each list's default columns and sort with no URL params.
// Spec 06 AC-8: sentence-case titles and "New …" buttons; AC-12: the order-items columns.
const LISTS = [
  ["/users", "Users", ["Name", "Email"], "Email", "New user"],
  ["/clients", "Clients", ["Name", "Full Name", "Phone", "Shipping Address"], "Name", "New client"],
  ["/products", "Products", ["Category", "Type Name", "Type Code", "Name", "Size", "Media"], "Category", "New product"],
  ["/product-categories", "Product categories", ["Name"], "Name", "New product category"],
  ["/product-types", "Product types", ["Name", "Code", "MM per Pleat"], "Code", "New product type"],
  ["/product-sizes", "Product sizes", ["Name"], "Name", "New product size"],
  ["/product-media", "Product media", ["Name", "Code", "Pleat Spacing"], "Code", "New product media"],
  ["/orders", "Orders", ["Client", "Order Number", "Delivery Docket", "Created", "Due", "Status"], "Created", "New order"],
  ["/order-items", "Order items", ["Client", "Order", "Product", "Size", "Qty", "Due", "Status"], "Due", "New item"],
  ["/delivery-dockets", "Delivery dockets", ["To Client", "Docket Number", "Date", "Status"], "Date", "New delivery docket"],
] as const;

for (const [path, title, columns, sortedBy, newLabel] of LISTS) {
  test(`AC-6 / 06 AC-8 ${title}: heading, columns, default sort, New button, no bulk selection`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    expect(await headers(page)).toEqual(columns);
    const sorted = page.getByRole("columnheader", { name: sortedBy, exact: true });
    await expect(sorted).toHaveAttribute("aria-sort", /ascending|descending/);
    const create = page.getByRole("link", { name: newLabel, exact: true });
    await expect(create).toBeVisible();
    await expect(create).toHaveAttribute("href", `${path}?new=1`);
    await expect(page.getByRole("checkbox")).toHaveCount(0);
  });
}

test("06 AC-11 sticky header, a single sort arrow, and the Showing footer", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 500 });
  await page.goto(`/product-sizes?name=${encodeURIComponent(`${fx.tag} sz`)}`);
  const header = page.getByRole("columnheader", { name: "Name", exact: true });
  expect(await header.evaluate((el) => getComputedStyle(el).position)).toBe("sticky");
  await expect(page.getByRole("columnheader").locator("svg")).toHaveCount(1);
  await expect(page.getByText("Showing 1–25 of 30", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Previous page" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Next page" })).toBeEnabled();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("Showing 26–30 of 30", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Previous page" })).toBeEnabled();
});

test("06 AC-9 filter controls show their label inside the control", async ({ page }) => {
  await page.goto("/product-types");
  const filters = page.getByRole("region", { name: "Filters" });
  const input = filters.getByLabel("Name", { exact: true });
  const label = filters.locator("label", { hasText: /^Name$/ });
  const [ib, lb] = await Promise.all([input.boundingBox(), label.boundingBox()]);
  // The label sits inside the control's box, on the same row as the input.
  expect(lb!.y).toBeGreaterThanOrEqual(ib!.y - 12);
  expect(lb!.y + lb!.height).toBeLessThanOrEqual(ib!.y + ib!.height + 12);
  expect(lb!.x).toBeLessThan(ib!.x);
});

test("AC-7 clicking a header sorts by it and a second click toggles direction", async ({ page }) => {
  await page.goto(`/product-sizes?name=${encodeURIComponent(`${fx.tag} sz`)}`);
  const header = page.getByRole("columnheader", { name: "Name", exact: true });
  await expect(header).toHaveAttribute("aria-sort", "ascending");
  await header.getByRole("button").click();
  await expect(header).toHaveAttribute("aria-sort", "descending");
  await expect(page).toHaveURL(/dir=desc/);
  await expect(page.getByRole("row").nth(1)).toContainText(`${fx.tag} sz 29`);
  await header.getByRole("button").click();
  await expect(header).toHaveAttribute("aria-sort", "ascending");
  await expect(page.getByRole("row").nth(1)).toContainText(`${fx.tag} sz 00`);
});

test("AC-8 page size defaults to 25, accepts 10/25/50/100, falls back for others, shows the total", async ({ page }) => {
  await page.goto(`/product-sizes?name=${encodeURIComponent(`${fx.tag} sz`)}`);
  const rows = page.getByRole("row");
  await expect(rows).toHaveCount(26); // header + 25
  await expect(page.getByText("Showing 1–25 of 30", { exact: true })).toBeVisible();
  const size = page.getByLabel("Rows per page");
  await expect(size).toHaveValue("25");
  expect(await size.locator("option").allTextContents()).toEqual(["10", "25", "50", "100"]);
  await size.selectOption("10");
  await expect(rows).toHaveCount(11);
  await expect(page).toHaveURL(/pageSize=10/);
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(rows).toHaveCount(11);
  await page.goto(`/product-sizes?name=${encodeURIComponent(`${fx.tag} sz`)}&pageSize=7`);
  await expect(rows).toHaveCount(26);
});

test("AC-9 filters live in the URL, survive a reload, and clear one at a time or all at once", async ({ page }) => {
  await page.goto("/product-types");
  const filters = page.getByRole("region", { name: "Filters" });
  await filters.getByLabel("Name", { exact: true }).fill(fx.names.type);
  await expect(page).toHaveURL(new RegExp(`name=${encodeURIComponent(fx.names.type).replace(/%20/g, "(%20|\\+)")}`));
  await filters.getByLabel("Code", { exact: true }).fill(fx.names.typeCode);
  await expect(page).toHaveURL(/code=/); // text filters reach the URL after a short debounce
  await expect(page.getByRole("row")).toHaveCount(2);
  await page.reload();
  await expect(page.getByRole("row")).toHaveCount(2);
  await expect(filters.getByLabel("Name", { exact: true })).toHaveValue(fx.names.type);
  await filters.getByRole("button", { name: "Clear Code filter" }).click();
  await expect(page).not.toHaveURL(/code=/);
  await expect(page).toHaveURL(/name=/);
  await filters.getByRole("button", { name: "Clear all" }).click();
  await expect(page).not.toHaveURL(/name=/);
});

test("AC-10 filters that aren't always shown are added from the Add filter menu", async ({ page }) => {
  await page.goto("/products");
  const filters = page.getByRole("region", { name: "Filters" });
  await expect(filters.getByLabel("Efficiency", { exact: true })).toHaveCount(0);
  await filters.getByRole("button", { name: "Add filter" }).click();
  await page.getByRole("menuitem", { name: "Efficiency" }).click();
  await expect(filters.getByLabel("Efficiency", { exact: true })).toBeVisible();
});

test("AC-11 list text filters match anywhere, case-insensitively", async ({ page }) => {
  const middle = fx.names.client.slice(3, 9).toUpperCase();
  await page.goto(`/clients?name=${encodeURIComponent(middle)}`);
  await expect(page.getByRole("row").filter({ hasText: fx.names.client })).toHaveCount(1);
});

// Spec 07 AC-1 supersedes spec 02's "rows open the detail page, each row has an Edit action":
// the title cell is a keyboard-reachable link that opens the edit panel.
test("Review 02 finding 3 / 07 AC-1: a row's title cell is a keyboard-reachable link to its edit panel", async ({ page }) => {
  await page.goto(`/orders?order_number=${fx.names.orderNumber}`);
  const row = page.getByRole("row").filter({ hasText: fx.names.orderNumber });
  const link = row.getByRole("link", { name: fx.names.orderNumber, exact: true });
  await expect(link).toHaveAttribute("href", new RegExp(`/orders\\?.*item=${fx.orderId}$`));
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/orders\\?.*item=${fx.orderId}$`));
  await expect(page.getByRole("region", { name: "Edit order" })).toBeVisible();
});

test("AC-6 / 07 AC-1 rows open the edit panel and there is no Edit column", async ({ page }) => {
  await page.goto(`/clients?name=${encodeURIComponent(fx.names.client)}`);
  const row = page.getByRole("row").filter({ hasText: fx.names.client });
  await expect(row.getByRole("link", { name: "Edit", exact: true })).toHaveCount(0);
  await row.getByRole("cell").last().click();
  await expect(page).toHaveURL(new RegExp(`/clients\\?.*item=${fx.clientId}$`));
  await expect(page.getByRole("region", { name: "Edit client" })).toBeVisible();
});

test("Review 02 finding 1: invalid filter values in the URL don't break the list", async ({ page }) => {
  for (const [path, heading] of [
    ["/orders?created_from=abc&client=abc", "Orders"],
    ["/order-items?height_from=x&status=nope", "Order items"],
    ["/delivery-dockets?status=nope", "Delivery dockets"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 }), path).toHaveText(heading);
    await expect(page.getByText(/^(Showing \d+–\d+ of \d+|No results)$/), path).toBeVisible();
  }
});

test("Review 02 finding 2: no duplicate ids after client-side navigation between forms", async ({ page }) => {
  await page.goto("/product-sizes/new");
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Product sizes");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Product Types" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Product types");
  await page.getByRole("link", { name: "New product type", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "New product type", exact: true })).toBeVisible();
  const duplicates = await page.evaluate(() => {
    const seen = new Map<string, number>();
    for (const el of document.querySelectorAll("[id]")) seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
    return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
  });
  expect(duplicates).toEqual([]);
  // Hidden preserved pages keep their own (now uniquely id'd) Name inputs; the dialog holds exactly one.
  // Scoped to the dialog: the list's Name filter stays visible behind it (spec 08; author-approved edit).
  const name = page.getByRole("dialog", { name: "New product type", exact: true }).getByLabel("Name", { exact: true });
  await expect(name).toHaveCount(1);
  await name.fill("x");
  await expect(name).toHaveValue("x");
});
