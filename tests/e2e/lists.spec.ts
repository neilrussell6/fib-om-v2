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
const LISTS = [
  ["/users", "Users", ["Email"], "Email"],
  ["/clients", "Clients", ["Name", "Full Name", "Phone", "Shipping Address"], "Name"],
  ["/products", "Products", ["Category", "Type Name", "Type Code", "Name", "Size", "Media"], "Category"],
  ["/product-categories", "Product Categories", ["Name"], "Name"],
  ["/product-types", "Product Types", ["Name", "Code", "MM per Pleat"], "Code"],
  ["/product-sizes", "Product Sizes", ["Name"], "Name"],
  ["/product-media", "Product Media", ["Name", "Code", "Pleat Spacing"], "Code"],
  ["/orders", "Orders", ["Client", "Order Number", "Delivery Docket", "Created", "Due", "Status"], "Created"],
  ["/order-items", "Order Items", ["Client", "Order Number", "Created", "Due", "Status"], "Due"],
  ["/delivery-dockets", "Delivery Dockets", ["To Client", "Docket Number", "Date", "Status"], "Date"],
] as const;

for (const [path, plural, columns, sortedBy] of LISTS) {
  test(`AC-6 ${plural}: heading, columns, default sort, Create button, no bulk selection`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(plural);
    expect(await headers(page)).toEqual(columns);
    const sorted = page.getByRole("columnheader", { name: sortedBy, exact: true });
    await expect(sorted).toHaveAttribute("aria-sort", /ascending|descending/);
    await expect(page.getByRole("link", { name: "Create", exact: true })).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
  });
}

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
  await expect(page.getByText("Total: 30", { exact: true })).toBeVisible();
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

test("Review 02 finding 3: a row's identifying cell is a keyboard-reachable link to its detail page", async ({ page }) => {
  await page.goto(`/orders?order_number=${fx.names.orderNumber}`);
  const row = page.getByRole("row").filter({ hasText: fx.names.orderNumber });
  const link = row.getByRole("link", { name: fx.names.orderNumber, exact: true });
  await expect(link).toHaveAttribute("href", `/orders/${fx.orderId}`);
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/orders/${fx.orderId}$`));
});

test("AC-6 rows open the detail page and each row has an Edit action", async ({ page }) => {
  await page.goto(`/clients?name=${encodeURIComponent(fx.names.client)}`);
  const row = page.getByRole("row").filter({ hasText: fx.names.client });
  await expect(row.getByRole("link", { name: "Edit" })).toHaveAttribute("href", `/clients/${fx.clientId}/edit`);
  await row.getByRole("cell").first().click();
  await expect(page).toHaveURL(new RegExp(`/clients/${fx.clientId}$`));
});

test("Review 02 finding 1: invalid filter values in the URL don't break the list", async ({ page }) => {
  for (const [path, heading] of [
    ["/orders?created_from=abc&client=abc", "Orders"],
    ["/order-items?height_from=x", "Order Items"],
    ["/delivery-dockets?status=nope", "Delivery Dockets"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 }), path).toHaveText(heading);
    await expect(page.getByText(/^Total: \d+$/), path).toBeVisible();
  }
});

test("Review 02 finding 2: no duplicate ids after client-side navigation between forms", async ({ page }) => {
  await page.goto("/product-sizes/new");
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Product Sizes");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Product Types" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Product Types");
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Create a Product Type");
  const duplicates = await page.evaluate(() => {
    const seen = new Map<string, number>();
    for (const el of document.querySelectorAll("[id]")) seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
    return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
  });
  expect(duplicates).toEqual([]);
  // Hidden preserved pages keep their own (now uniquely id'd) Name inputs; only one is visible.
  const name = page.getByLabel("Name", { exact: true }).filter({ visible: true });
  await expect(name).toHaveCount(1);
  await name.fill("x");
  await expect(name).toHaveValue("x");
});
