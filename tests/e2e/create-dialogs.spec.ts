import { expect, type Locator, type Page, test } from "@playwright/test";
import { createFixture, type Fixture, removeFixture } from "../helpers/fixtures";
import { withDb } from "../helpers/test-db";
import { expectToast, fieldError, pickReference } from "./form-helpers";

// Spec 08: create dialogs on every list (AC-1 – AC-13). AC-14 (axe) is in shell.spec.ts, and AC-15
// is the existing create-page tests, which still go to /new directly.

const one = <T = Record<string, unknown>>(text: string, params: unknown[] = []) =>
  withDb(async (c) => (await c.query(text, params)).rows[0] as T);
const count = async (text: string, params: unknown[]) => Number((await one<{ n: number }>(text, params)).n);

let fx: Fixture;
test.beforeAll(async () => {
  fx = await createFixture();
});
test.afterAll(() => removeFixture(fx.tag));
test.beforeEach(async ({ page, context }) => {
  await context.clearCookies({ name: "sidebar" });
  await page.setViewportSize({ width: 1440, height: 900 });
});

const dialog = (page: Page, title: string) => page.getByRole("dialog", { name: title, exact: true });
const field = (d: Locator, label: string) => d.getByLabel(label, { exact: true });
const docketNumber = (id: number) => String(id).padStart(6, "0");

/** Visits the dashboard, then the list, so history has a page before the list. */
async function fromDashboard(page: Page, url: string) {
  await page.goto("/");
  await page.goto(url);
}

/** Waits for the dialog's controls to hydrate (they stay disabled until then). */
async function ready(d: Locator) {
  await expect(d.getByRole("button", { name: /^(Add|Adding)/ })).toBeVisible();
  await expect(d.locator("fieldset[disabled]")).toHaveCount(0);
}

async function openFromButton(page: Page, newLabel: string, title: string) {
  await page.getByRole("link", { name: newLabel, exact: true }).click();
  const d = dialog(page, title);
  await expect(d).toBeVisible();
  await ready(d);
  return d;
}

const LISTS = [
  ["/order-items", "New item", "New order item", "Add a product line to an existing order."],
  ["/orders", "New order", "New order", "Start a new order for a client."],
  ["/delivery-dockets", "New delivery docket", "New delivery docket", "Start a docket for delivering orders to a client."],
  ["/products", "New product", "New product", "Add a product to the catalogue."],
  ["/product-categories", "New product category", "New product category", "Choose which columns Order Items shows for this category."],
  ["/product-types", "New product type", "New product type", "Add a product type with its code."],
  ["/product-sizes", "New product size", "New product size", "Add a size that products are made in."],
  ["/product-media", "New product media", "New product media", "Add a filter media with its code."],
  ["/clients", "New client", "New client", "Add a customer you take orders for."],
  ["/users", "New user", "New user", "Give someone access to Fibatron."],
] as const;

test.describe("08 AC-1 the New button opens the dialog", () => {
  for (const [path, newLabel, title, description] of LISTS) {
    test(`${path}: button, ?new=1 and ?new=yes`, async ({ page }) => {
      await page.goto(`${path}?dir=desc`);
      const d = await openFromButton(page, newLabel, title);
      await expect(page).toHaveURL(/new=1/);
      await expect(page).toHaveURL(/dir=desc/);
      await expect(page).not.toHaveURL(/\/new(\?|$)/);
      await expect(d.getByRole("heading", { name: title, exact: true })).toBeVisible();
      await expect(d.getByText(description, { exact: true })).toBeVisible();

      await page.goto(`${path}?new=1`);
      await expect(dialog(page, title)).toBeVisible();
      await page.goto(`${path}?new=yes`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });
  }
});

test.describe("08 AC-2 the dialog's look", () => {
  test("overlay, width, radius, footer and button labels; full width on small screens", async ({ page }) => {
    await page.goto("/clients?new=1");
    const d = dialog(page, "New client");
    await ready(d);
    const overlay = page.locator("[data-create-dialog-overlay]");
    await expect(overlay).toHaveCSS("background-color", "rgba(18, 30, 34, 0.42)");
    await expect(d).toHaveCSS("max-width", "560px");
    await expect(d).toHaveCSS("border-radius", "10px");
    await expect(d.locator("[data-create-dialog-footer]")).toHaveCSS("background-color", "rgb(250, 251, 251)");
    await expect(d.getByRole("button", { name: "Add client", exact: true })).toBeVisible();

    await page.goto("/order-items?new=1");
    await expect(dialog(page, "New order item").getByRole("button", { name: "Add item", exact: true })).toBeVisible();

    await page.setViewportSize({ width: 600, height: 800 });
    await page.goto("/clients?new=1");
    await ready(dialog(page, "New client"));
    const box = await dialog(page, "New client").boundingBox();
    expect(Math.round(box!.width)).toBe(600);
  });
});

test.describe("08 AC-3 fields, optional hints, sections and defaults", () => {
  test("(optional) only on optional fields; 13 collapsed sections; status defaults", async ({ page }) => {
    await page.goto("/clients?new=1");
    const c = dialog(page, "New client");
    await ready(c);
    await expect(c.locator('[data-optional-for="full_name"]')).toHaveText("(optional)");
    await expect(c.locator('[data-optional-for="phone"]')).toHaveText("(optional)");
    await expect(c.locator('[data-optional-for="name"]')).toHaveCount(0);

    await page.goto("/product-categories?new=1");
    const pc = dialog(page, "New product category");
    await ready(pc);
    const sections = pc.locator("button[aria-expanded]");
    await expect(sections).toHaveCount(13);
    for (const s of await sections.all()) await expect(s).toHaveAttribute("aria-expanded", "false");

    await page.goto("/orders?new=1");
    const o = dialog(page, "New order");
    await ready(o);
    await expect(field(o, "Status")).toHaveValue("new");
    await expect(o.locator('[data-optional-for="delivery_docket_id"]')).toHaveText("(optional)");
    await expect(o.locator('[data-optional-for="order_number"]')).toHaveCount(0);

    await page.goto("/delivery-dockets?new=1");
    const dk = dialog(page, "New delivery docket");
    await ready(dk);
    await expect(field(dk, "Status")).toHaveValue("current");
  });
});

test.describe("08 AC-4 adding closes the dialog and shows the row", () => {
  test("Client, Product Size and Product", async ({ page }) => {
    // Client
    await page.goto(`/clients?name=${fx.tag}`);
    await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
    let d = await openFromButton(page, "New client", "New client");
    await field(d, "Name").fill(`${fx.tag} DlgClient`);
    await d.getByRole("button", { name: "Add client", exact: true }).click();
    await expect(d).toBeHidden();
    await expectToast(page, "Client successfully created");
    await expect(page.getByRole("cell", { name: `${fx.tag} DlgClient`, exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
    expect(await count("SELECT count(*)::int AS n FROM clients WHERE name = $1", [`${fx.tag} DlgClient`])).toBe(1);

    // Product Size
    await page.goto(`/product-sizes?name=${fx.tag}`);
    d = await openFromButton(page, "New product size", "New product size");
    await field(d, "Name").fill(`${fx.tag} DlgSize`);
    await d.getByRole("button", { name: "Add product size", exact: true }).click();
    await expect(d).toBeHidden();
    await expectToast(page, "Product Size successfully created");
    await expect(page.getByRole("cell", { name: `${fx.tag} DlgSize`, exact: true })).toBeVisible();
    expect(await count("SELECT count(*)::int AS n FROM product_sizes WHERE name = $1", [`${fx.tag} DlgSize`])).toBe(1);

    // Product
    await page.goto(`/products?name=${fx.tag}`);
    d = await openFromButton(page, "New product", "New product");
    await field(d, "Name").fill(`${fx.tag} DlgProduct`);
    await pickReference(page, "Category", fx.names.category, fx.names.category, d);
    await pickReference(page, "Type", fx.names.type, `${fx.names.typeCode} · ${fx.names.type}`, d);
    await pickReference(page, "Size", fx.names.size, fx.names.size, d);
    await pickReference(page, "Media", fx.names.media, `${fx.names.mediaCode} · ${fx.names.media}`, d);
    await d.getByRole("button", { name: "Add product", exact: true }).click();
    await expect(d).toBeHidden();
    await expectToast(page, "Product successfully created");
    await expect(page.getByRole("cell", { name: `${fx.tag} DlgProduct`, exact: true })).toBeVisible();
    expect(await count("SELECT count(*)::int AS n FROM products WHERE name = $1", [`${fx.tag} DlgProduct`])).toBe(1);
  });
});

/** Fills the Order Items dialog's required fields (Order and Product already picked or not). */
async function fillItem(page: Page, d: Locator, partNumber: string, { order = true, product = true } = {}) {
  if (order) await pickReference(page, "Order", fx.names.orderNumber, `${fx.names.orderNumber} · ${fx.names.client}`, d);
  if (product) await pickReference(page, "Product", fx.names.product, fx.names.product, d);
  if (partNumber) await field(d, "Part Number").fill(partNumber);
  await field(d, "Quantity").fill("3");
  await field(d, "Height").fill("500");
  await field(d, "Width").fill("600");
  await field(d, "Depth").fill("50");
}

test.describe("08 AC-5 Create another", () => {
  test("Product Types: stays open, resets, focuses Name, and a second add makes a second record", async ({ page }) => {
    await page.goto(`/product-types?name=${fx.tag}`);
    const d = await openFromButton(page, "New product type", "New product type");
    const another = d.getByRole("checkbox", { name: "Create another", exact: true });
    await expect(another).not.toBeChecked();
    await another.check();
    await field(d, "Name").fill(`${fx.tag} CA1`);
    await field(d, "Code").fill(`${fx.tag}CA1`);
    await d.getByRole("button", { name: "Add product type", exact: true }).click();
    await expectToast(page, "Product Type successfully created");
    await expect(d).toBeVisible();
    await expect(field(d, "Name")).toHaveValue("");
    await expect(field(d, "Code")).toHaveValue("");
    await expect(field(d, "Name")).toBeFocused();
    // The list behind the modal dialog is aria-hidden, so the role query includes hidden elements.
    await expect(page.getByRole("cell", { name: `${fx.tag} CA1`, exact: true, includeHidden: true })).toBeVisible();

    await field(d, "Name").fill(`${fx.tag} CA2`);
    await field(d, "Code").fill(`${fx.tag}CA2`);
    await d.getByRole("button", { name: "Add product type", exact: true }).click();
    await expect(page.getByRole("cell", { name: `${fx.tag} CA2`, exact: true, includeHidden: true })).toBeVisible();
    expect(await count("SELECT count(*)::int AS n FROM product_types WHERE name IN ($1, $2)", [`${fx.tag} CA1`, `${fx.tag} CA2`])).toBe(2);
  });

  test("Order Items keeps the Order and focuses Product; Delivery Dockets have no Create another", async ({ page }) => {
    await page.goto(`/order-items?order=${fx.orderId}`);
    const d = await openFromButton(page, "New item", "New order item");
    await fillItem(page, d, `${fx.tag}-CA`);
    await d.getByRole("checkbox", { name: "Create another", exact: true }).check();
    await d.getByRole("button", { name: "Add item", exact: true }).click();
    await expectToast(page, "Order Item successfully created");
    await expect(d).toBeVisible();
    await expect(d.getByRole("combobox", { name: "Order", exact: true })).toContainText(fx.names.orderNumber);
    await expect(d.getByRole("combobox", { name: "Product", exact: true })).toBeFocused();
    await expect(field(d, "Part Number")).toHaveValue("");

    await page.goto("/delivery-dockets?new=1");
    const dk = dialog(page, "New delivery docket");
    await ready(dk);
    await expect(dk.getByRole("checkbox", { name: "Create another" })).toHaveCount(0);
  });
});

test.describe("08 AC-6 dockets go to their detail page", () => {
  test("Add goes to the new docket; one Back shows the list with no dialog", async ({ page }) => {
    await fromDashboard(page, `/delivery-dockets?to_client=${encodeURIComponent(fx.names.client)}`);
    const d = await openFromButton(page, "New delivery docket", "New delivery docket");
    await pickReference(page, "To Client", fx.names.client, fx.names.client, d);
    await d.getByRole("button", { name: "Add delivery docket", exact: true }).click();
    await expect(page).toHaveURL(/\/delivery-dockets\/\d+$/);
    await expectToast(page, "Delivery Docket successfully created");
    await page.goBack();
    await expect(page).toHaveURL(/\/delivery-dockets\?/);
    await expect(page).not.toHaveURL(/new=1/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Delivery dockets");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test.describe("08 AC-7 errors", () => {
  test("Product Media without a Code: field error, focus, nothing written", async ({ page }) => {
    await page.goto("/product-media?new=1");
    const d = dialog(page, "New product media");
    await ready(d);
    await field(d, "Name").fill(`${fx.tag} NoCode`);
    await d.getByRole("button", { name: "Add product media", exact: true }).click();
    await expect(fieldError(page, "code")).toHaveText(/required/i);
    await expect(field(d, "Code")).toBeFocused();
    await expect(d).toBeVisible();
    expect(await count("SELECT count(*)::int AS n FROM product_media WHERE name = $1", [`${fx.tag} NoCode`])).toBe(0);
  });

  test("Order Items: an empty Part Number is focused with nothing expanded; a bad Attributes value expands Attributes", async ({ page }) => {
    await page.goto("/order-items?new=1");
    const d = dialog(page, "New order item");
    await ready(d);
    await fillItem(page, d, "");
    await d.getByRole("button", { name: "Add item", exact: true }).click();
    await expect(fieldError(page, "part_number")).toHaveText(/required/i);
    await expect(field(d, "Part Number")).toBeFocused();
    for (const s of await d.locator("button[aria-expanded]").all()) await expect(s).toHaveAttribute("aria-expanded", "false");

    await field(d, "Part Number").fill(`${fx.tag}-ERR`);
    const attrs = d.getByRole("button", { name: /^Attributes/ });
    await attrs.click();
    await field(d, "Number").fill("1.5");
    await attrs.click(); // collapse it again
    await expect(attrs).toHaveAttribute("aria-expanded", "false");
    await d.getByRole("button", { name: "Add item", exact: true }).click();
    await expect(attrs).toHaveAttribute("aria-expanded", "true");
    await expect(attrs).toContainText("1 error");
    await expect(field(d, "Number")).toBeFocused();
    expect(await count("SELECT count(*)::int AS n FROM order_items WHERE part_number = $1", [`${fx.tag}-ERR`])).toBe(0);
  });
});

test.describe("08 AC-8 Orders dialog", () => {
  test("Status New; changing Client clears Delivery Docket; dockets are the client's; the order is saved", async ({ page }) => {
    await page.goto("/orders?new=1");
    const d = dialog(page, "New order");
    await ready(d);
    await expect(field(d, "Status")).toHaveValue("new");
    await pickReference(page, "Client", fx.names.client, fx.names.client, d);
    await d.getByRole("combobox", { name: "Delivery Docket", exact: true }).click();
    await page.getByPlaceholder("Search…").fill(docketNumber(fx.docketId).slice(-4));
    await expect(page.getByRole("option", { name: docketNumber(fx.docketId), exact: true })).toBeVisible();
    await page.getByPlaceholder("Search…").fill(docketNumber(fx.otherDocketId).slice(-4));
    await expect(page.getByRole("option", { name: docketNumber(fx.otherDocketId), exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByPlaceholder("Search…")).toHaveCount(0);
    await expect(d).toBeVisible();

    await pickReference(page, "Delivery Docket", docketNumber(fx.docketId), docketNumber(fx.docketId), d);
    await pickReference(page, "Client", fx.names.otherClient, fx.names.otherClient, d);
    await expect(d.getByRole("combobox", { name: "Delivery Docket", exact: true })).not.toContainText(docketNumber(fx.docketId));

    await field(d, "Order Number").fill(`${fx.tag}-DLG`);
    await field(d, "Due Date").fill("2026-12-24");
    await d.getByRole("button", { name: "Add order", exact: true }).click();
    await expect(d).toBeHidden();
    await expectToast(page, "Order successfully created");
    const o = await one<{ client_id: string; status: string; delivery_docket_id: string | null }>(
      "SELECT client_id, status::text, delivery_docket_id FROM orders WHERE order_number = $1",
      [`${fx.tag}-DLG`],
    );
    expect(o).toEqual({ client_id: String(fx.otherClientId), status: "new", delivery_docket_id: null });
  });
});

test.describe("08 AC-9 Users dialog", () => {
  test("Password is required; a user with a blank name is created", async ({ page }) => {
    await page.goto("/users?new=1");
    const d = dialog(page, "New user");
    await ready(d);
    const email = `${fx.tag}-dialog@example.com`;
    await field(d, "Email").fill(email);
    await d.getByRole("button", { name: "Add user", exact: true }).click();
    await expect(fieldError(page, "password")).toBeVisible();
    await expect(d.locator('[data-optional-for="password"]')).toHaveCount(0);
    await field(d, "Password").fill("dialog-password-12");
    await d.getByRole("button", { name: "Add user", exact: true }).click();
    await expect(d).toBeHidden();
    await expectToast(page, "User successfully created");
    const u = await one<{ name: string | null; password_hash: string }>("SELECT name, password_hash FROM users WHERE email = $1", [email]);
    expect(u.name).toBeNull();
    expect(u.password_hash).toMatch(/^\$2[aby]\$/);
  });
});

test.describe("08 AC-10 Order Items dialog", () => {
  test("Size follows the product; the stepper stops at 1; the item is created on the chosen Order", async ({ page }) => {
    await page.goto("/order-items?new=1");
    const d = dialog(page, "New order item");
    await ready(d);
    const size = field(d, "Size");
    await expect(size).toHaveValue("—");
    await expect(size).toHaveAttribute("readonly", "");
    await pickReference(page, "Order", fx.names.orderNumber, `${fx.names.orderNumber} · ${fx.names.client}`, d);
    await pickReference(page, "Product", fx.names.product, fx.names.product, d);
    await expect(size).toHaveValue(fx.names.size);

    const qty = field(d, "Quantity");
    const minus = d.getByRole("button", { name: "Decrease quantity", exact: true });
    const plus = d.getByRole("button", { name: "Increase quantity", exact: true });
    await qty.fill("1");
    await expect(minus).toBeDisabled();
    await plus.click();
    await expect(qty).toHaveValue("2");
    await plus.click();
    await expect(qty).toHaveValue("3");
    await minus.click();
    await expect(qty).toHaveValue("2");
    await minus.click();
    await expect(qty).toHaveValue("1");
    await expect(minus).toBeDisabled();

    await field(d, "Part Number").fill(`${fx.tag}-AC10`);
    await field(d, "Height").fill("500");
    await field(d, "Width").fill("600");
    await field(d, "Depth").fill("50");
    await d.getByRole("button", { name: "Add item", exact: true }).click();
    await expect(d).toBeHidden();
    await expectToast(page, "Order Item successfully created");
    const item = await one<{ order_id: string; quantity: number }>("SELECT order_id, quantity FROM order_items WHERE part_number = $1", [`${fx.tag}-AC10`]);
    expect(item).toEqual({ order_id: String(fx.orderId), quantity: 1 });
  });
});

test.describe("08 AC-11 closing", () => {
  test("with values, Cancel, ×, Escape and an overlay click ask first; without values they close at once", async ({ page }) => {
    await page.goto(`/clients?name=${fx.tag}`);
    const d = await openFromButton(page, "New client", "New client");
    await field(d, "Name").fill("typed");
    const confirm = page.getByRole("alertdialog", { name: "Discard changes?" });
    const keep = () => confirm.getByRole("button", { name: "Keep editing" }).click();

    await d.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(confirm).toBeVisible();
    await keep();
    await expect(confirm).toBeHidden();
    await d.getByRole("button", { name: "Close", exact: true }).click();
    await expect(confirm).toBeVisible();
    await keep();
    await page.keyboard.press("Escape");
    await expect(confirm).toBeVisible();
    await keep();
    await page.mouse.click(5, 5);
    await expect(confirm).toBeVisible();
    await keep();
    await expect(d).toBeVisible();
    await expect(field(d, "Name")).toHaveValue("typed");
    await d.getByRole("button", { name: "Cancel", exact: true }).click();
    await confirm.getByRole("button", { name: "Discard" }).click();
    await expect(d).toBeHidden();

    for (const close of [
      (x: Locator) => x.getByRole("button", { name: "Cancel", exact: true }).click(),
      (x: Locator) => x.getByRole("button", { name: "Close", exact: true }).click(),
      () => page.keyboard.press("Escape"),
      () => page.mouse.click(5, 5),
    ]) {
      const x = await openFromButton(page, "New client", "New client");
      await close(x);
      await expect(x).toBeHidden();
      await expect(confirm).toHaveCount(0);
    }
  });

  test("closing removes ?new, keeps ?item and the filters, and returns focus to New", async ({ page }) => {
    await page.goto(`/clients?name=${fx.tag}&item=${fx.clientId}`);
    await expect(page.getByRole("region", { name: "Edit client" })).toBeVisible();
    const d = await openFromButton(page, "New client", "New client");
    await d.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(d).toBeHidden();
    await expect(page).not.toHaveURL(/new=/);
    await expect(page).toHaveURL(new RegExp(`item=${fx.clientId}`));
    await expect(page).toHaveURL(new RegExp(`name=${fx.tag}`));
    await expect(page.getByRole("link", { name: "New client", exact: true })).toBeFocused();
  });
});

test.describe("08 AC-12 history", () => {
  test("button → Cancel or Add, then one Back leaves the list", async ({ page }) => {
    await fromDashboard(page, `/product-sizes?name=${fx.tag}`);
    let d = await openFromButton(page, "New product size", "New product size");
    await d.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(d).toBeHidden();
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);

    await fromDashboard(page, `/product-sizes?name=${fx.tag}`);
    d = await openFromButton(page, "New product size", "New product size");
    await field(d, "Name").fill(`${fx.tag} HistSize`);
    await d.getByRole("button", { name: "Add product size", exact: true }).click();
    await expect(d).toBeHidden();
    await expect(page.getByRole("cell", { name: `${fx.tag} HistSize`, exact: true })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
  });

  test("a direct ?new=1 load closes onto the list; Back closes an open dialog", async ({ page }) => {
    await page.goto("/product-sizes?new=1");
    const d = dialog(page, "New product size");
    await ready(d);
    await d.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(d).toBeHidden();
    await expect(page).toHaveURL(/\/product-sizes$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Product sizes");

    await fromDashboard(page, "/product-sizes");
    const again = await openFromButton(page, "New product size", "New product size");
    await page.goBack();
    await expect(again).toBeHidden();
    await expect(page).toHaveURL(/\/product-sizes$/);
  });

  test("a panel stays open under the dialog; panel → dialog → Cancel → close panel → one Back leaves the list", async ({ page }) => {
    await fromDashboard(page, `/clients?name=${fx.tag}`);
    await page.getByRole("link", { name: fx.names.client, exact: true }).click();
    const panel = page.getByRole("region", { name: "Edit client" });
    await expect(panel).toBeVisible();
    const d = await openFromButton(page, "New client", "New client");
    await d.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(d).toBeHidden();
    await expect(panel).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`item=${fx.clientId}`));
    await panel.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(panel).toBeHidden();
    await expect(page).not.toHaveURL(/item=/);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
  });

  test("at 800px, ?item=&new=1 shows only the dialog; Cancel brings back the panel sheet", async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    await page.goto(`/clients?name=${fx.tag}&item=${fx.clientId}&new=1`);
    const d = dialog(page, "New client");
    await ready(d);
    await expect(page.getByRole("dialog", { name: "Edit client" })).toHaveCount(0);
    await d.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(d).toBeHidden();
    await expect(page.getByRole("dialog", { name: "Edit client" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`item=${fx.clientId}`));
  });
});

test.describe("08 AC-13 saving", () => {
  test("Adding… while saving, and a double click creates one record", async ({ page }) => {
    await page.goto(`/product-sizes?name=${fx.tag}`);
    const d = await openFromButton(page, "New product size", "New product size");
    await field(d, "Name").fill(`${fx.tag} Dbl`);
    // Slow the Server Action down so the pending state can be seen.
    await page.route("**/product-sizes**", async (route) => {
      if (route.request().method() === "POST") await new Promise((r) => setTimeout(r, 800));
      await route.continue();
    });
    await d.getByRole("button", { name: "Add product size", exact: true }).dblclick();
    await expect(d.getByRole("button", { name: "Adding…", exact: true })).toBeDisabled();
    await expect(d).toBeHidden();
    await expectToast(page, "Product Size successfully created");
    expect(await count("SELECT count(*)::int AS n FROM product_sizes WHERE name = $1", [`${fx.tag} Dbl`])).toBe(1);
  });
});
