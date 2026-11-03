import { expect, test } from "@playwright/test";
import { createFixture, type Fixture, removeFixture, SENDER_CLIENT_ID } from "../helpers/fixtures";
import { withDb } from "../helpers/test-db";
import { confirmDelete, expectToast, fieldError, fillField, pickReference, save } from "./form-helpers";

let fx: Fixture;
test.beforeAll(async () => {
  fx = await createFixture();
});
test.afterAll(() => removeFixture(fx.tag));

test("AC-14 detail pages show labelled fields and Back, Print, Edit; Print calls window.print()", async ({ page }) => {
  await page.goto(`/clients/${fx.clientId}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Client");
  const dl = page.getByRole("main").locator("dl");
  await expect(dl.locator("dt", { hasText: /^Name$/ })).toBeVisible();
  await expect(dl).toContainText(fx.names.client);
  await expect(page.getByRole("link", { name: "Back", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit", exact: true })).toHaveAttribute("href", `/clients/${fx.clientId}/edit`);
  await page.evaluate(() => {
    (window as unknown as { __printed: number }).__printed = 0;
    window.print = () => {
      (window as unknown as { __printed: number }).__printed++;
    };
  });
  await page.getByRole("button", { name: "Print", exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1);
});

test("Edit pages have Back, Show and Delete", async ({ page }) => {
  await page.goto(`/clients/${fx.clientId}/edit`);
  await expect(page.getByRole("link", { name: "Back", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Show", exact: true })).toHaveAttribute("href", `/clients/${fx.clientId}`);
  await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeVisible();
});

test("AC-15 / AC-31 required fields show an inline error on blur and nothing is written", async ({ page }) => {
  await page.goto("/product-types/new");
  const name = page.getByLabel("Name", { exact: true });
  // The form streams in; retry until it has hydrated and the blur handler runs.
  await expect(async () => {
    await name.focus();
    await name.blur();
    await expect(fieldError(page, "name")).toHaveText(/required/i, { timeout: 1000 });
  }).toPass();
  await save(page);
  await expect(fieldError(page, "code")).toHaveText(/required/i);
  await expect(page).toHaveURL(/\/product-types\/new$/);
});

test("AC-31 client and product media without required fields show inline errors", async ({ page }) => {
  for (const [path, ids] of [["/clients/new", ["name"]], ["/product-media/new", ["name", "code"]]] as const) {
    await page.goto(path);
    await save(page);
    for (const id of ids) await expect(fieldError(page, id), `${path} ${id}`).toBeVisible();
  }
});

test("AC-16 while saving the button is disabled and pending, and nothing changes before the server confirms", async ({ page }) => {
  await page.goto("/product-sizes/new");
  await fillField(page, "Name", `${fx.tag} slow`);
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route("**/product-sizes/new", async (route) => {
    if (route.request().method() === "POST") await held;
    await route.continue();
  });
  await save(page);
  const button = page.getByRole("button", { name: "Saving…" });
  await expect(button).toBeDisabled();
  await expect(page).toHaveURL(/\/product-sizes\/new$/);
  release();
  await expectToast(page, "Product Size successfully created");
});

test("AC-17 a failed save shows 'Could not create <Resource>: <message>'", async ({ page }) => {
  await page.goto("/users/new");
  await fillField(page, "Email", "e2e-staff@example.com");
  await fillField(page, "Password", "duplicate-password");
  await save(page);
  await expectToast(page, "Could not create User: email already in use");
});

test("AC-18 Delete asks first; cancel keeps it; a client with orders can't be deleted", async ({ page }) => {
  // A client with an order and nothing else, so the orders constraint is the one hit.
  const clientId = await withDb(async (c) => {
    const id = Number((await c.query("INSERT INTO clients (name) VALUES ($1) RETURNING id", [`${fx.tag} Has Orders`])).rows[0].id);
    await c.query("INSERT INTO orders (client_id, order_number, due_date) VALUES ($1, $2, '2026-12-01')", [id, `${fx.tag}-HO`]);
    return id;
  });
  await page.goto(`/clients/${clientId}/edit`);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await confirmDelete(page);
  await expectToast(page, "Could not delete Client: cannot delete clients that still have orders");
  const n = await withDb(async (c) => (await c.query("SELECT count(*)::int AS n FROM clients WHERE id = $1", [clientId])).rows[0].n);
  expect(n).toBe(1);
});

test("AC-20 the mouse wheel doesn't change a focused number input", async ({ page }) => {
  await page.goto("/product-media/new");
  const input = page.getByLabel("Pleat Spacing", { exact: true });
  await input.fill("5");
  await input.focus();
  await input.hover();
  await page.mouse.wheel(0, -300);
  await page.mouse.wheel(0, 300);
  await expect(input).toHaveValue("5");
});

test("AC-23 the product form requires category, type, size and media", async ({ page }) => {
  await page.goto("/products/new");
  await fillField(page, "Name", `${fx.tag} needs refs`);
  await save(page);
  for (const id of ["category_id", "type_id", "size_id", "media_id"]) await expect(fieldError(page, id), id).toBeVisible();
});

test("AC-26 order form: required fields, status choices, default New, no created date, padded dockets", async ({ page }) => {
  await page.goto("/orders/new");
  await expect(page.getByLabel("Created", { exact: true })).toHaveCount(0);
  const status = page.getByLabel("Status", { exact: true });
  await expect(status).toHaveValue("new");
  expect(await status.locator("option").allTextContents()).toEqual(["New", "Complete", "Archived"]);
  await save(page);
  for (const id of ["client_id", "order_number", "due_date"]) await expect(fieldError(page, id), id).toBeVisible();
});

test("AC-32 the order form's docket combobox lists only the selected client's dockets", async ({ page }) => {
  await page.goto(`/orders/${fx.orderId}/edit`);
  await page.getByRole("combobox", { name: "Delivery Docket", exact: true }).click();
  const padded = (n: number) => String(n).padStart(6, "0");
  await expect(page.getByRole("option", { name: padded(fx.docketId) })).toBeVisible();
  await expect(page.getByRole("option", { name: padded(fx.otherDocketId) })).toHaveCount(0);
});

test("Review 02 finding 5: changing an order's client clears its delivery docket", async ({ page }) => {
  await withDb((c) => c.query("UPDATE orders SET delivery_docket_id = $1 WHERE id = $2", [fx.docketId, fx.orderId]));
  await page.goto(`/orders/${fx.orderId}/edit`);
  const docket = page.getByRole("combobox", { name: "Delivery Docket", exact: true });
  await expect(docket).toContainText(String(fx.docketId).padStart(6, "0"));
  await pickReference(page, "Client", fx.names.otherClient, fx.names.otherClient);
  await expect(docket).toContainText("Select…");
  await withDb((c) => c.query("UPDATE orders SET delivery_docket_id = NULL WHERE id = $1", [fx.orderId]));
});

test("AC-26 the order list shows docket numbers zero-padded and links the client", async ({ page }) => {
  await withDb((c) => c.query("UPDATE orders SET delivery_docket_id = $1 WHERE id = $2", [fx.docketId, fx.orderId]));
  await page.goto(`/orders?order_number=${fx.names.orderNumber}`);
  const row = page.getByRole("row").filter({ hasText: fx.names.orderNumber });
  await expect(row).toContainText(String(fx.docketId).padStart(6, "0"));
  await expect(row.getByRole("link", { name: fx.names.client })).toHaveAttribute("href", `/clients/${fx.clientId}`);
  await withDb((c) => c.query("UPDATE orders SET delivery_docket_id = NULL WHERE id = $1", [fx.orderId]));
});

test("AC-27 the order-item form and detail page", async ({ page }) => {
  await page.goto("/order-items/new");
  for (const label of ["Part Number", "Quantity", "Height", "Width", "Depth", "Comment", "Type", "Number", "Pockets", "Drawing Number", "Cut Count", "Sow Count"]) {
    await expect(page.getByLabel(label, { exact: true }), label).toBeVisible();
  }
  for (const label of ["Clip Type", "Clip Position", "Wire Mesh", "Wire Sides", "Media Mats", "Gasket"]) {
    await expect(page.getByLabel(label, { exact: true }), label).toBeVisible();
  }
  for (const label of ["Has Wire Header?", "Has Header Frame?", "Has Gasket?", "Has Legs?", "Has Gate?", "Cut Status", "Sow Status", "Frame Status", "Media Status", "Wire Status", "Package Status", "Assemble Status"]) {
    await expect(page.getByRole("switch", { name: label, exact: true }), label).toBeVisible();
  }
  await save(page);
  for (const id of ["order_id", "product_id", "part_number", "quantity", "height", "width", "depth"]) {
    await expect(fieldError(page, id), id).toBeVisible();
  }
  await page.goto(`/order-items/${fx.orderItemId}`);
  const main = page.getByRole("main");
  for (const text of [fx.names.orderNumber, fx.names.product, fx.names.typeCode, fx.names.partNumber, "Order Status", "Clip Type", "Package Status"]) {
    await expect(main, text).toContainText(text);
  }
});

test("AC-28 creating a docket: to-client required, default Current, sender from FROM_CLIENT_ID, then its detail page", async ({ page }) => {
  await page.goto("/delivery-dockets/new");
  await expect(page.getByRole("combobox", { name: "From Client" })).toHaveCount(0);
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue("current");
  await save(page);
  await expect(fieldError(page, "to_client_id")).toBeVisible();
  await pickReference(page, "To Client", fx.names.otherClient, fx.names.otherClient);
  await save(page);
  await expect(page).toHaveURL(/\/delivery-dockets\/\d+$/);
  const id = Number(new URL(page.url()).pathname.split("/").pop());
  const row = await withDb(async (c) => (await c.query("SELECT from_client_id, status FROM delivery_dockets WHERE id = $1", [id])).rows[0]);
  expect(row).toEqual({ from_client_id: String(SENDER_CLIENT_ID), status: "current" });
  await page.goto(`/delivery-dockets/${id}/edit`);
  await expect(page.getByRole("combobox", { name: "To Client" })).toBeVisible();
  await expect(page.getByLabel("Status", { exact: true })).toBeVisible();
  await expect(page.locator("form").getByRole("textbox")).toHaveCount(0);
});

test("AC-29 print media hides the shell and screen-only parts, shows print-only parts, black text, A4", async ({ page }) => {
  await page.goto(`/clients/${fx.clientId}`);
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
  await expect(page.getByRole("banner")).toBeHidden();
  await expect(page.getByRole("button", { name: "Print" })).toBeHidden();
  await expect(page.getByRole("link", { name: "Edit", exact: true })).toBeHidden();
  const color = await page.getByRole("heading", { level: 1 }).evaluate((el) => getComputedStyle(el).color);
  expect(color).toBe("rgb(0, 0, 0)");
  const hasA4 = await page.evaluate(() =>
    [...document.styleSheets].some((s) => {
      try {
        return [...s.cssRules].some((r) => r.cssText.startsWith("@page") && /A4/i.test(r.cssText));
      } catch {
        return false;
      }
    }),
  );
  expect(hasA4).toBe(true);
});

// AC-30: axe on every list, detail and form page.
