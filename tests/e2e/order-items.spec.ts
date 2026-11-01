import { expect, type Page, test } from "@playwright/test";
import { createFixture, type Fixture, removeFixture } from "../helpers/fixtures";
import { withDb } from "../helpers/test-db";
import { pickReference } from "./form-helpers";

// Spec 06: the Order Items list (AC-12 – AC-17) and its edit panel (AC-18 – AC-26).

const todayIn = (tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

let fx: Fixture;
const ids = {} as Record<"soonA" | "soonB" | "overdue" | "complete" | "archived", number>;
const orderIds = {} as Record<"soon" | "overdue" | "complete" | "archived", number>;
let otherProductId: number;

test.beforeAll(async () => {
  fx = await createFixture();
  const today = todayIn("Australia/Brisbane");
  await withDb(async (c) => {
    const q = async (text: string, params: unknown[]) => Number((await c.query(text, params)).rows[0]?.id);
    // The fixture's category shows Cut and Package; the fixture order/item are removed from the counts below.
    await c.query("UPDATE product_categories SET show_cut_status = true, show_package_status = true WHERE id = $1", [fx.categoryId]);
    await c.query("DELETE FROM order_items WHERE id = $1", [fx.orderItemId]);
    await c.query("DELETE FROM orders WHERE id = $1", [fx.orderId]);
    const order = (n: string, status: string, due: string) =>
      q("INSERT INTO orders (client_id, order_number, due_date, date, status) VALUES ($1, $2, $3, '2026-10-20', $4) RETURNING id", [
        fx.clientId, `${fx.tag}-${n}`, due, status,
      ]);
    const item = (orderId: number, pn: string, qty: number, extra = "") =>
      q(
        `INSERT INTO order_items (order_id, product_id, part_number, quantity, height, width, depth${extra ? ", wire_status" : ""})
         VALUES ($1, $2, $3, $4, 500, 600, 50${extra ? ", true" : ""}) RETURNING id`,
        [orderId, fx.productId, `${fx.tag}-${pn}`, qty],
      );
    orderIds.soon = await order("SOON", "new", addDays(today, 3));
    orderIds.overdue = await order("LATE", "new", addDays(today, -2));
    orderIds.complete = await order("DONE", "complete", addDays(today, 20));
    orderIds.archived = await order("ARCH", "archived", addDays(today, -40));
    ids.soonA = await item(orderIds.soon, "A", 4);
    ids.soonB = await item(orderIds.soon, "B", 6, "wire"); // Wire done although the category hides it
    ids.overdue = await item(orderIds.overdue, "C", 1);
    ids.complete = await item(orderIds.complete, "D", 2);
    ids.archived = await item(orderIds.archived, "E", 3);
    const cat2 = await q("INSERT INTO product_categories (name, show_frame_status) VALUES ($1, true) RETURNING id", [`${fx.tag} Cat2`]);
    const size2 = await q("INSERT INTO product_sizes (name) VALUES ($1) RETURNING id", [`${fx.tag} Size2`]);
    otherProductId = await q(
      "INSERT INTO products (name, category_id, type_id, size_id, media_id) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [`${fx.tag} Product2`, cat2, fx.typeId, size2, fx.mediaId],
    );
  });
});
test.afterAll(() => removeFixture(fx.tag));
test.beforeEach(async ({ page, context }) => {
  await context.clearCookies({ name: "sidebar" });
  await page.setViewportSize({ width: 1440, height: 900 });
});

const listUrl = (extra = "") => `/order-items?client=${fx.clientId}${extra}`;
const panel = (page: Page) => page.getByRole("region", { name: "Edit order item" });
const headers = (page: Page) => page.getByRole("columnheader").allTextContents().then((t) => t.map((x) => x.trim()));
const rowFor = (page: Page, orderNumber: string) => page.getByRole("row").filter({ hasText: orderNumber });
const tab = (page: Page, name: string) => page.getByRole("tablist", { name: "Status" }).getByRole("tab", { name: new RegExp(`^${name}\\b`) });
const tabCount = (page: Page, name: string) => tab(page, name).getByTestId("tab-count");
const quantity = (id: number) => withDb(async (c) => (await c.query("SELECT quantity FROM order_items WHERE id = $1", [id])).rows[0].quantity);
const orderRow = (id: number) =>
  withDb(async (c) => (await c.query("SELECT due_date::text, status::text FROM orders WHERE id = $1", [id])).rows[0]);

test.describe("list", () => {
  test("06 AC-12 columns, client link, right-aligned Qty, default sort by Due descending", async ({ page }) => {
    await page.goto(listUrl());
    expect(await headers(page)).toEqual(["Client", "Order", "Product", "Size", "Qty", "Due", "Status"]);
    await expect(page.getByRole("columnheader", { name: "Due" })).toHaveAttribute("aria-sort", "descending");
    const row = rowFor(page, `${fx.tag}-SOON`).first();
    await expect(row.getByRole("link", { name: fx.names.client })).toHaveAttribute("href", `/clients/${fx.clientId}`);
    const qty = row.getByRole("cell").nth(4);
    expect(await qty.evaluate((el) => getComputedStyle(el).textAlign)).toBe("right");
    // Due descending: the complete order (today + 20) comes first, the archived one (today - 40) last.
    await expect(page.getByRole("row").nth(1)).toContainText(`${fx.tag}-DONE`);
    await expect(page.getByRole("row").last()).toContainText(`${fx.tag}-ARCH`);
  });

  test("06 AC-13 tabs with counts that follow the other filters, in the URL, resetting the page", async ({ page }) => {
    await page.goto(listUrl("&page=2"));
    for (const [name, n] of [["All", "5"], ["New", "3"], ["Complete", "1"], ["Archived", "1"]] as const) {
      await expect(tabCount(page, name)).toHaveText(n);
    }
    await expect(tab(page, "All")).toHaveAttribute("aria-selected", "true");
    await tab(page, "New").click();
    await expect(page).toHaveURL(/status=new/);
    await expect(page).not.toHaveURL(/page=2/);
    await expect(tab(page, "New")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("row")).toHaveCount(4);
    await page.reload();
    await expect(tab(page, "New")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("row")).toHaveCount(4);

    // The counts follow the order filter, not the selected tab.
    await page.goto(listUrl(`&order=${orderIds.soon}&status=complete`));
    await expect(tabCount(page, "All")).toHaveText("2");
    await expect(tabCount(page, "New")).toHaveText("2");
    await expect(tabCount(page, "Complete")).toHaveText("0");

    // An unknown status behaves as All.
    await page.goto(listUrl("&status=dispatched"));
    await expect(tab(page, "All")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("row")).toHaveCount(6);
  });

  test("06 AC-13 the tabs are keyboard operable", async ({ page }) => {
    await page.goto(listUrl());
    await tab(page, "All").focus();
    await page.keyboard.press("ArrowRight");
    await expect(tab(page, "New")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/status=new/);
  });

  test("06 AC-14 Client and Order always shown; Due and Created from Add filter; no Order Status filter", async ({ page }) => {
    await page.goto("/order-items");
    const filters = page.getByRole("region", { name: "Filters" });
    await expect(filters.getByRole("combobox", { name: "Client" })).toBeVisible();
    await expect(filters.getByRole("combobox", { name: "Order" })).toBeVisible();
    await expect(filters.getByLabel("Order Status")).toHaveCount(0);
    await expect(filters.getByLabel("Due From", { exact: true })).toHaveCount(0);
    await filters.getByRole("button", { name: "Add filter" }).click();
    const menu = page.getByRole("menu");
    for (const f of ["Due From", "Due To", "Created From", "Created To"]) await expect(menu.getByRole("menuitem", { name: f })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Order Status" })).toHaveCount(0);
  });

  test("06 AC-15 relative due lines and status pill colours", async ({ page }) => {
    await page.goto(listUrl());
    const due = (n: string) => rowFor(page, `${fx.tag}-${n}`).first().getByRole("cell").nth(5);
    await expect(due("SOON")).toContainText("in 3d");
    await expect(due("LATE")).toContainText("2d overdue");
    await expect(due("DONE")).toContainText("—");
    expect(await due("LATE").getByText("2d overdue").evaluate((el) => getComputedStyle(el).color)).toBe("rgb(179, 38, 30)");
    expect(await due("SOON").getByText("in 3d").evaluate((el) => getComputedStyle(el).color)).toBe("rgb(138, 90, 18)");
    const pill = (n: string, label: string) => rowFor(page, `${fx.tag}-${n}`).first().getByRole("cell").nth(6).getByText(label, { exact: true });
    expect(await pill("SOON", "New").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(232, 238, 248)");
    expect(await pill("DONE", "Complete").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(227, 242, 234)");
    expect(await pill("ARCH", "Archived").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(238, 240, 240)");
  });

  test("06 AC-16 a row click or the Order link opens the panel, selects the row, and never navigates", async ({ page }) => {
    await page.goto(listUrl());
    await expect(page.getByRole("columnheader", { name: /actions/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Edit", exact: true })).toHaveCount(0);
    const row = rowFor(page, `${fx.tag}-LATE`);
    await row.getByRole("cell").nth(2).click();
    await expect(page).toHaveURL(new RegExp(`item=${ids.overdue}`));
    await expect(page).toHaveURL(/\/order-items\?/);
    await expect(panel(page)).toBeVisible();
    await expect(row).toHaveAttribute("aria-selected", "true");

    // Keyboard: the Order link of another row.
    const link = rowFor(page, `${fx.tag}-DONE`).getByRole("link", { name: `${fx.tag}-DONE`, exact: true });
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`item=${ids.complete}`));
    await expect(panel(page)).toContainText(`${fx.tag}-DONE · line 1`);
  });

  test("06 AC-17 Size and Qty hide beside the panel unless wide with the sidebar collapsed", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(listUrl(`&item=${ids.soonA}`));
    await expect(panel(page)).toBeVisible();
    expect(await headers(page)).toEqual(["Client", "Order", "Product", "Due", "Status"]);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect.poll(() => headers(page)).toEqual(["Client", "Order", "Product", "Size", "Qty", "Due", "Status"]);
  });
});

test.describe("panel", () => {
  test("06 AC-18 a deep link opens the full panel", async ({ page }) => {
    await page.goto(`/order-items?item=${ids.soonB}`);
    const p = panel(page);
    await expect(p).toContainText(`${fx.tag}-SOON · line 2`);
    await expect(p.getByRole("heading", { level: 2 })).toHaveText(fx.names.product);
    await expect(p.getByRole("link", { name: fx.names.client })).toHaveAttribute("href", `/clients/${fx.clientId}`);
    await expect(p.getByRole("combobox", { name: "Product" })).toContainText(fx.names.product);
    await expect(p.getByRole("combobox", { name: "Order" })).toContainText(`${fx.tag}-SOON`);
    await expect(p.getByLabel("Size", { exact: true })).toHaveValue(fx.names.size);
    await expect(p.getByLabel("Size", { exact: true })).toHaveAttribute("readonly", "");
    await expect(p.getByLabel("Quantity", { exact: true })).toHaveValue("6");
    await expect(p.getByLabel("Created", { exact: true })).toHaveValue("20 Oct 2026");
    await expect(p.getByLabel("Due", { exact: true })).toBeVisible();
    await expect(p.getByRole("radiogroup", { name: "Order status" }).getByRole("radio", { name: "New" })).toBeChecked();
    await expect(p).toContainText(`Due date and status apply to all 2 items on order ${fx.tag}-SOON`);
    // Stages: the category's Cut and Package, plus Wire (done but hidden by the category).
    const stages = p.getByRole("group", { name: "Stages" });
    expect((await stages.getByRole("button").allTextContents()).map((t) => t.replace(/Not used by this category/, "").trim())).toEqual([
      "Cut", "Wire", "Package",
    ]);
    await expect(stages.getByRole("button", { name: /Wire/ })).toHaveAttribute("aria-pressed", "true");
    await expect(stages).toContainText("Not used by this category");
    // Details and Attributes hold the rest of the item form.
    await p.getByRole("button", { name: /^Details/ }).click();
    for (const f of ["Part Number", "Height", "Width", "Depth", "Comment"]) await expect(p.getByLabel(f, { exact: true })).toBeVisible();
    await p.getByRole("button", { name: /^Attributes/ }).click();
    await expect(p.getByRole("switch", { name: "Has Wire Header?" })).toBeVisible();
    await expect(p.getByLabel("Clip Type", { exact: true })).toBeVisible();
  });

  test("06 AC-18 the panel opens for an item outside the current tab", async ({ page }) => {
    await page.goto(listUrl(`&status=archived&item=${ids.soonA}`));
    await expect(panel(page)).toContainText(`${fx.tag}-SOON · line 1`);
    await expect(page.locator('tr[aria-selected="true"]')).toHaveCount(0);
    await panel(page).getByRole("button", { name: "Close" }).click();
    await expect(panel(page)).toBeHidden();
    await expect(page).toHaveURL(/status=archived/);
    await expect(tab(page, "Archived")).toHaveAttribute("aria-selected", "true");
  });

  test("06 AC-18 non-numeric and unknown ids open no panel; unknown shows a toast", async ({ page }) => {
    await page.goto("/order-items?item=abc");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Order items");
    await expect(panel(page)).toHaveCount(0);
    await expect(page.getByText("Order item not found")).toHaveCount(0);
    await page.goto("/order-items?item=999999999");
    await expect(panel(page)).toHaveCount(0);
    await expect(page.getByText("Order item not found", { exact: true })).toBeVisible();
  });

  test("06 AC-19 saving a quantity closes the panel, toasts, and updates the row", async ({ page }) => {
    await page.goto(listUrl(`&item=${ids.soonA}`));
    await panel(page).getByLabel("Quantity", { exact: true }).fill("9");
    await panel(page).getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Order Item successfully updated", { exact: true })).toBeVisible();
    await expect(panel(page)).toBeHidden();
    await expect(page).not.toHaveURL(/item=/);
    await expect(rowFor(page, `${fx.tag}-SOON`).getByRole("cell", { name: "9", exact: true })).toHaveCount(1);
    expect(await quantity(ids.soonA)).toBe(9);
  });

  test("06 AC-20 / AC-25 changing status updates every item of the order, the counts, and offers View", async ({ page }) => {
    await page.goto(listUrl(`&status=new&item=${ids.soonA}`));
    const p = panel(page);
    await p.getByLabel("Due", { exact: true }).fill("2026-12-30");
    await p.getByRole("radiogroup", { name: "Order status" }).getByRole("radio", { name: "Complete" }).click();
    await p.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Order Item successfully updated. Moved to Complete.")).toBeVisible();
    expect(await orderRow(orderIds.soon)).toEqual({ due_date: "2026-12-30", status: "complete" });
    await expect(tabCount(page, "New")).toHaveText("1");
    await expect(tabCount(page, "Complete")).toHaveText("3");
    await expect(rowFor(page, `${fx.tag}-SOON`)).toHaveCount(0); // both items left the New tab
    await page.getByRole("button", { name: "View" }).click();
    await expect(page).toHaveURL(/status=complete/);
    await expect(page).toHaveURL(new RegExp(`item=${ids.soonA}`));
    await expect(panel(page)).toBeVisible();
    await expect(rowFor(page, `${fx.tag}-SOON`)).toHaveCount(2);
    // restore
    await withDb((c) => c.query("UPDATE orders SET status = 'new' WHERE id = $1", [orderIds.soon]));
  });

  test("06 AC-21 changing Order reloads the order fields and saves the move", async ({ page }) => {
    await page.goto(listUrl(`&item=${ids.overdue}`));
    const p = panel(page);
    await pickReference(page, "Order", `${fx.tag}-DONE`, `${fx.tag}-DONE · ${fx.names.client}`, p);
    await expect(p.getByRole("radiogroup", { name: "Order status" }).getByRole("radio", { name: "Complete" })).toBeChecked();
    await expect(p).toContainText(`Due date and status apply to all 1 items on order ${fx.tag}-DONE`);
    await expect(p.getByRole("link", { name: /View order/ })).toHaveAttribute("href", `/orders/${orderIds.complete}`);
    await p.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/^Order Item successfully updated/)).toBeVisible();
    const moved = await withDb(async (c) => (await c.query("SELECT order_id FROM order_items WHERE id = $1", [ids.overdue])).rows[0].order_id);
    expect(Number(moved)).toBe(orderIds.complete);
    expect((await orderRow(orderIds.overdue)).status).toBe("new");
    await withDb((c) => c.query("UPDATE order_items SET order_id = $1 WHERE id = $2", [orderIds.overdue, ids.overdue]));
  });

  test("06 AC-22 changing Product updates Size and Stages and keeps stage values; a hidden done stage can be cleared", async ({ page }) => {
    await page.goto(listUrl(`&item=${ids.soonB}`));
    const p = panel(page);
    const stages = p.getByRole("group", { name: "Stages" });
    await pickReference(page, "Product", `${fx.tag} Product2`, `${fx.tag} Product2`, p);
    await expect(p.getByLabel("Size", { exact: true })).toHaveValue(`${fx.tag} Size2`);
    // New category shows Frame; Wire (done) stays listed as hidden.
    expect((await stages.getByRole("button").allTextContents()).map((t) => t.replace(/Not used by this category/, "").trim())).toEqual([
      "Frame", "Wire",
    ]);
    await expect(stages.getByRole("button", { name: /Wire/ })).toHaveAttribute("aria-pressed", "true");
    await stages.getByRole("button", { name: /Wire/ }).click();
    await expect(stages.getByRole("button", { name: /Wire/ })).toHaveAttribute("aria-pressed", "false");
    await p.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/^Order Item successfully updated/)).toBeVisible();
    const row = await withDb(async (c) => (await c.query("SELECT product_id, wire_status FROM order_items WHERE id = $1", [ids.soonB])).rows[0]);
    expect(row).toEqual({ product_id: String(otherProductId), wire_status: false });
  });

  test("06 AC-23 an error in a collapsed section expands it, counts it, and focuses the field", async ({ page }) => {
    await page.goto(listUrl(`&item=${ids.complete}`));
    const p = panel(page);
    const details = p.getByRole("button", { name: /^Details/ });
    await expect(details).toHaveAttribute("aria-expanded", "false");
    await details.click();
    await p.getByLabel("Part Number", { exact: true }).fill("");
    await details.click(); // collapse it again before saving
    await expect(details).toHaveAttribute("aria-expanded", "false");
    await p.getByLabel("Quantity", { exact: true }).fill("42");
    await p.getByRole("button", { name: "Save", exact: true }).click();
    await expect(details).toHaveAttribute("aria-expanded", "true");
    await expect(details).toContainText("1 error");
    await expect(p.getByLabel("Part Number", { exact: true })).toBeFocused();
    await expect(panel(page)).toBeVisible();
    expect(await quantity(ids.complete)).toBe(2);
  });

  test("06 AC-24 discard guard, focus return, and Back closes the panel", async ({ page }) => {
    await page.goto(listUrl());
    const link = rowFor(page, `${fx.tag}-ARCH`).getByRole("link", { name: `${fx.tag}-ARCH`, exact: true });
    await link.click();
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).getByRole("heading", { level: 2 })).toBeFocused();
    // No changes: Escape closes at once and focus returns to the row's Order link.
    await page.keyboard.press("Escape");
    await expect(panel(page)).toBeHidden();
    await expect(link).toBeFocused();

    await link.click();
    await panel(page).getByLabel("Quantity", { exact: true }).fill("11");
    for (const close of [
      () => panel(page).getByRole("button", { name: "Cancel" }).click(),
      () => panel(page).getByRole("button", { name: "Close" }).click(),
      () => page.keyboard.press("Escape"),
    ]) {
      await close();
      const dialog = page.getByRole("alertdialog", { name: "Discard changes?" });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Keep editing" }).click();
      await expect(panel(page)).toBeVisible();
      await expect(panel(page).getByLabel("Quantity", { exact: true })).toHaveValue("11");
    }
    await panel(page).getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("alertdialog", { name: "Discard changes?" }).getByRole("button", { name: "Discard" }).click();
    await expect(panel(page)).toBeHidden();
    await expect(page).not.toHaveURL(/item=/);
    expect(await quantity(ids.archived)).toBe(3);

    // Back closes an open panel.
    await link.click();
    await expect(panel(page)).toBeVisible();
    await page.goBack();
    await expect(panel(page)).toBeHidden();
    await expect(page).toHaveURL(/\/order-items\?client=/);
  });

  test("06 AC-26 View order links to the order; below 1024px the panel is a sheet", async ({ page }) => {
    await page.goto(listUrl(`&item=${ids.archived}`));
    await expect(panel(page).getByRole("link", { name: /View order/ })).toHaveAttribute("href", `/orders/${orderIds.archived}`);
    await page.setViewportSize({ width: 900, height: 800 });
    await page.reload();
    const sheet = page.getByRole("dialog", { name: "Edit order item" });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText(`${fx.tag}-ARCH · line 1`);
  });
});
