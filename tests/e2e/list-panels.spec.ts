import { type Browser, expect, type Page, test } from "@playwright/test";
import { createFixture, type Fixture, removeFixture, SENDER_CLIENT_ID } from "../helpers/fixtures";
import { withDb } from "../helpers/test-db";
import { fieldError, pickReference, setSwitch } from "./form-helpers";

// Spec 07: panels on every list (AC-1, AC-6 – AC-14), status tabs and pills (AC-2, AC-4, AC-5),
// and the 06 review fixes (AC-16 – AC-18).

const todayIn = (tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const one = <T = Record<string, unknown>>(text: string, params: unknown[] = []) =>
  withDb(async (c) => (await c.query(text, params)).rows[0] as T);
const newId = async (text: string, params: unknown[]) => Number((await one<{ id: string }>(text, params)).id);

let fx: Fixture;
const orders = {} as Record<"soon" | "late" | "done" | "arch", number>;
let archivedDocketId: number;
let cat2Id: number;
let userId: number;
let userEmail: string;
let itemA: number;

test.beforeAll(async () => {
  fx = await createFixture();
  const today = todayIn("Australia/Brisbane");
  const order = (n: string, status: string, due: string) =>
    newId("INSERT INTO orders (client_id, order_number, due_date, date, status) VALUES ($1, $2, $3, '2026-10-20', $4) RETURNING id", [
      fx.clientId, `${fx.tag}-${n}`, due, status,
    ]);
  orders.soon = await order("SOON", "new", addDays(today, 3));
  orders.late = await order("LATE", "new", addDays(today, -2));
  orders.done = await order("DONE", "complete", addDays(today, 20));
  orders.arch = await order("ARCH", "archived", addDays(today, -40));
  archivedDocketId = await newId(
    "INSERT INTO delivery_dockets (from_client_id, to_client_id, status) VALUES ($1, $2, 'archived') RETURNING id",
    [SENDER_CLIENT_ID, fx.clientId],
  );
  cat2Id = await newId("INSERT INTO product_categories (name) VALUES ($1) RETURNING id", [`${fx.tag} Cat2`]);
  userEmail = `${fx.tag}-panel@example.com`;
  userId = await newId("INSERT INTO users (email, password_hash) VALUES ($1, 'hash-before') RETURNING id", [userEmail]);
  // Two items on the SOON order for the Order Items checks (AC-16 – AC-18).
  const item = (pn: string) =>
    newId(
      "INSERT INTO order_items (order_id, product_id, part_number, quantity, height, width, depth) VALUES ($1, $2, $3, 1, 1, 1, 1) RETURNING id",
      [orders.soon, fx.productId, `${fx.tag}-${pn}`],
    );
  itemA = await item("IA");
  await item("IB"); // the SOON order holds items A and B (07 AC-17)
});
test.afterAll(() => removeFixture(fx.tag));
test.beforeEach(async ({ page, context }) => {
  await context.clearCookies({ name: "sidebar" });
  await page.setViewportSize({ width: 1440, height: 900 });
});

type ListDef = {
  key: string;
  path: string;
  singular: string;
  region: string;
  query: () => string;
  id: () => number;
  title: () => string;
  view: string;
};
const docketNumber = (id: number) => String(id).padStart(6, "0");
const LISTS: ListDef[] = [
  { key: "orders", path: "/orders", singular: "Order", region: "Edit order", query: () => `client=${fx.clientId}`, id: () => fx.orderId, title: () => fx.names.orderNumber, view: "View order" },
  {
    key: "delivery_dockets", path: "/delivery-dockets", singular: "Delivery docket", region: "Edit delivery docket",
    query: () => `to_client=${encodeURIComponent(fx.names.client)}`, id: () => fx.docketId, title: () => docketNumber(fx.docketId), view: "View delivery docket",
  },
  { key: "clients", path: "/clients", singular: "Client", region: "Edit client", query: () => `name=${fx.tag}`, id: () => fx.clientId, title: () => fx.names.client, view: "View client" },
  { key: "products", path: "/products", singular: "Product", region: "Edit product", query: () => `name=${fx.tag}`, id: () => fx.productId, title: () => fx.names.product, view: "View product" },
  {
    key: "product_categories", path: "/product-categories", singular: "Product category", region: "Edit product category",
    query: () => `name=${fx.tag}`, id: () => fx.categoryId, title: () => fx.names.category, view: "View product category",
  },
  { key: "product_types", path: "/product-types", singular: "Product type", region: "Edit product type", query: () => `name=${fx.tag}`, id: () => fx.typeId, title: () => fx.names.type, view: "View product type" },
  { key: "product_sizes", path: "/product-sizes", singular: "Product size", region: "Edit product size", query: () => `name=${fx.tag}`, id: () => fx.sizeId, title: () => fx.names.size, view: "View product size" },
  { key: "product_media", path: "/product-media", singular: "Product media", region: "Edit product media", query: () => `name=${fx.tag}`, id: () => fx.mediaId, title: () => fx.names.media, view: "View product media" },
  { key: "users", path: "/users", singular: "User", region: "Edit user", query: () => `email=${fx.tag}`, id: () => userId, title: () => userEmail, view: "View user" },
];
const list = (key: string) => LISTS.find((l) => l.key === key)!;

const panel = (page: Page, region: string) => page.getByRole("region", { name: region });
const rowWith = (page: Page, text: string) => page.getByRole("row").filter({ hasText: text });
const tab = (page: Page, name: string) => page.getByRole("tablist", { name: "Status" }).getByRole("tab", { name: new RegExp(`^${name}\\b`) });
const tabCount = (page: Page, name: string) => tab(page, name).getByTestId("tab-count");
const saveBtn = (page: Page, region: string) => panel(page, region).getByRole("button", { name: "Save", exact: true });

test.describe("07 AC-1 click to edit on every list", () => {
  for (const l of LISTS) {
    test(`${l.key}: a row click opens the panel; the title link is keyboard reachable; no Edit column`, async ({ page }) => {
      await page.goto(`${l.path}?${l.query()}`);
      await expect(page.getByRole("link", { name: "Edit", exact: true })).toHaveCount(0);
      const row = rowWith(page, l.title()).first();
      await row.getByRole("cell").last().click();
      await expect(page).toHaveURL(new RegExp(`item=${l.id()}`));
      await expect(page).toHaveURL(new RegExp(`^[^?]*${l.path}\\?`));
      await expect(panel(page, l.region)).toBeVisible();
      await expect(row).toHaveAttribute("aria-selected", "true");

      // The title link (keyboard): close first, then open again from the link.
      await panel(page, l.region).getByRole("button", { name: "Close" }).click();
      await expect(panel(page, l.region)).toBeHidden();
      const link = row.getByRole("link", { name: l.title(), exact: true });
      await expect(link).toHaveAttribute("data-item-link", String(l.id()));
      await link.focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(new RegExp(`item=${l.id()}`));
      await expect(panel(page, l.region)).toBeVisible();
    });
  }

  test("products: the title link is in the Name column, not Category", async ({ page }) => {
    await page.goto(`/products?name=${fx.tag}`);
    await expect(rowWith(page, fx.names.product).first()).toBeVisible(); // allTextContents() doesn't wait
    const headers = (await page.getByRole("columnheader").allTextContents()).map((t) => t.trim());
    expect(headers).toContain("Name");
    const nameIdx = headers.indexOf("Name");
    const row = rowWith(page, fx.names.product).first();
    await expect(row.getByRole("cell").nth(nameIdx).getByRole("link", { name: fx.names.product, exact: true })).toBeVisible();
    await expect(row.getByRole("cell").nth(headers.indexOf("Category")).getByRole("link")).toHaveCount(0);
  });

  test("orders: the Client link still goes to the client", async ({ page }) => {
    await page.goto(`/orders?client=${fx.clientId}`);
    const row = rowWith(page, fx.names.orderNumber).first();
    await row.getByRole("link", { name: fx.names.client, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/clients/${fx.clientId}$`));
  });
});

test.describe("07 AC-2 status tabs on orders and delivery dockets", () => {
  test("orders: counts under the client filter, URL, page reset, reload, unknown → All, no Status filter", async ({ page }) => {
    await page.goto(`/orders?client=${fx.clientId}&page=2`);
    for (const [name, n] of [["All", "5"], ["New", "3"], ["Complete", "1"], ["Archived", "1"]] as const) {
      await expect(tabCount(page, name)).toHaveText(n);
    }
    const filters = page.getByRole("region", { name: "Filters" });
    await expect(filters.getByLabel("Status", { exact: true })).toHaveCount(0);
    await tab(page, "Complete").click();
    await expect(page).toHaveURL(/status=complete/);
    await expect(page).not.toHaveURL(/page=2/);
    await expect(page.getByRole("row")).toHaveCount(2);
    await page.reload();
    await expect(tab(page, "Complete")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("row")).toHaveCount(2);
    await page.goto(`/orders?client=${fx.clientId}&status=current`);
    await expect(tab(page, "All")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("row")).toHaveCount(6);
  });

  test("delivery dockets: All / Current / Archived with counts, filtering, no Status filter", async ({ page }) => {
    await page.goto(`/delivery-dockets?to_client=${encodeURIComponent(fx.names.client)}`);
    const tabs = (await page.getByRole("tablist", { name: "Status" }).getByRole("tab").allTextContents()).map((t) => t.replace(/\d+$/, "").trim());
    expect(tabs).toEqual(["All", "Current", "Archived"]);
    for (const [name, n] of [["All", "2"], ["Current", "1"], ["Archived", "1"]] as const) await expect(tabCount(page, name)).toHaveText(n);
    await expect(page.getByRole("region", { name: "Filters" }).getByLabel("Status", { exact: true })).toHaveCount(0);
    await tab(page, "Archived").click();
    await expect(page).toHaveURL(/status=archived/);
    await expect(page.getByRole("row")).toHaveCount(2);
    await expect(rowWith(page, docketNumber(archivedDocketId))).toHaveCount(1);
  });
});

test.describe("07 AC-4 / AC-5 pills and relative due", () => {
  test("orders: status pills and the relative Due line", async ({ page }) => {
    await page.goto(`/orders?client=${fx.clientId}`);
    // allTextContents() doesn't wait: let the table render first.
    await expect(rowWith(page, `${fx.tag}-SOON`)).toHaveCount(1);
    const headers = (await page.getByRole("columnheader").allTextContents()).map((t) => t.trim());
    expect(headers).toContain("Due");
    const dueIdx = headers.indexOf("Due");
    const statusIdx = headers.indexOf("Status");
    const cell = (n: string, i: number) => rowWith(page, `${fx.tag}-${n}`).first().getByRole("cell").nth(i);
    await expect(cell("SOON", dueIdx)).toContainText("in 3d");
    await expect(cell("LATE", dueIdx)).toContainText("2d overdue");
    await expect(cell("DONE", dueIdx)).toContainText("—");
    await expect(cell("ARCH", dueIdx)).toContainText("—");
    expect(await cell("LATE", dueIdx).getByText("2d overdue").evaluate((el) => getComputedStyle(el).color)).toBe("rgb(179, 38, 30)");
    expect(await cell("SOON", dueIdx).getByText("in 3d").evaluate((el) => getComputedStyle(el).color)).toBe("rgb(138, 90, 18)");
    const pill = (n: string, label: string) => cell(n, statusIdx).getByText(label, { exact: true });
    expect(await pill("SOON", "New").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(232, 238, 248)");
    expect(await pill("DONE", "Complete").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(227, 242, 234)");
    expect(await pill("ARCH", "Archived").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(238, 240, 240)");
  });

  test("delivery dockets: Current and Archived pills", async ({ page }) => {
    await page.goto(`/delivery-dockets?to_client=${encodeURIComponent(fx.names.client)}`);
    const current = rowWith(page, docketNumber(fx.docketId)).getByText("Current", { exact: true });
    const archived = rowWith(page, docketNumber(archivedDocketId)).getByText("Archived", { exact: true });
    expect(await current.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(232, 238, 248)");
    expect(await archived.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(238, 240, 240)");
  });
});

test.describe("07 AC-6 deep links", () => {
  // Spec 09 T E4: every list opens the same RecordPanel (its fields are unit tested per resource
  // in tests/unit/record-panel-fields.test.tsx); the browser keeps a simple list and Orders.
  for (const l of LISTS.filter((x) => x.key === "clients" || x.key === "orders")) {
    test(`${l.key}: ?item opens the panel with the caption and title heading`, async ({ page }) => {
      await page.goto(`${l.path}?item=${l.id()}`);
      const p = panel(page, l.region);
      await expect(p).toBeVisible();
      await expect(p.getByText(l.singular, { exact: true }).first()).toBeVisible();
      await expect(p.getByRole("heading", { level: 2 })).toHaveText(l.title());
      await expect(p.getByRole("link", { name: new RegExp(l.view) })).toHaveAttribute("href", `${l.path}/${l.id()}`);
    });
  }

  test("a record outside the current page or tab still opens; bad ids open nothing", async ({ page }) => {
    await page.goto(`/orders?client=${fx.clientId}&status=archived&item=${orders.soon}`);
    await expect(panel(page, "Edit order").getByRole("heading", { level: 2 })).toHaveText(`${fx.tag}-SOON`);
    await page.goto("/clients?item=abc");
    await expect(panel(page, "Edit client")).toHaveCount(0);
    await expect(page.getByText("Client not found")).toHaveCount(0);
    await page.goto("/clients?item=999999999");
    await expect(panel(page, "Edit client")).toHaveCount(0);
    await expect(page.getByText("Client not found", { exact: true })).toBeVisible();
    // Spec 09 T E12 (merged from order-items.spec 06 AC-18): the same on Order Items' own panel.
    await page.goto("/order-items?item=abc");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Order items");
    await expect(panel(page, "Edit order item")).toHaveCount(0);
    await expect(page.getByText("Order item not found")).toHaveCount(0);
    await page.goto("/order-items?item=999999999");
    await expect(panel(page, "Edit order item")).toHaveCount(0);
    await expect(page.getByText("Order item not found", { exact: true })).toBeVisible();
  });
});

test.describe("07 AC-7 simple panels save", () => {
  test("clients, product types, sizes and media persist and refresh the row", async ({ page }) => {
    const cases: [ListDef, string, string, string, string][] = [
      [list("clients"), "Phone", "0400 111 222", "SELECT phone AS v FROM clients WHERE id = $1", "Client successfully updated"],
      [list("product_types"), "MM per Pleat", "17", "SELECT millimetres_per_pleat::text AS v FROM product_types WHERE id = $1", "Product Type successfully updated"],
      [list("product_media"), "Pleat Spacing", "9", "SELECT pleat_spacing::text AS v FROM product_media WHERE id = $1", "Product Media successfully updated"],
      [list("product_sizes"), "Name", `${fx.names.size} Wide`, "SELECT name AS v FROM product_sizes WHERE id = $1", "Product Size successfully updated"],
    ];
    for (const [l, label, value, sql, toast] of cases) {
      await page.goto(`${l.path}?${l.query()}&item=${l.id()}`);
      await panel(page, l.region).getByLabel(label, { exact: true }).fill(value);
      await saveBtn(page, l.region).click();
      await expect(page.getByText(toast, { exact: true })).toBeVisible();
      await expect(panel(page, l.region)).toBeHidden();
      await expect(page).not.toHaveURL(/item=/);
      await expect(page.getByRole("cell", { name: value, exact: true })).toBeVisible();
      expect(String((await one<{ v: string }>(sql, [l.id()])).v)).toBe(value);
    }
    await one("UPDATE product_sizes SET name = $1 WHERE id = $2", [fx.names.size, fx.sizeId]);
  });
});

test.describe("07 AC-8 / AC-9 orders and delivery dockets panels", () => {
  test("orders: Created read-only, status chips, client link, Due save updates the row", async ({ page }) => {
    await page.goto(`/orders?client=${fx.clientId}&item=${orders.late}`);
    const p = panel(page, "Edit order");
    await expect(p.getByLabel("Created", { exact: true })).toHaveAttribute("readonly", "");
    await expect(p.getByRole("radiogroup", { name: "Status" }).getByRole("radio", { name: "New" })).toBeChecked();
    await expect(p.getByRole("link", { name: fx.names.client, exact: true })).toHaveAttribute("href", `/clients/${fx.clientId}`);
    const due = addDays(todayIn("Australia/Brisbane"), 30);
    await p.getByLabel("Due Date", { exact: true }).fill(due);
    await saveBtn(page, "Edit order").click();
    await expect(page.getByText("Order successfully updated", { exact: true })).toBeVisible();
    await expect(rowWith(page, `${fx.tag}-LATE`)).toContainText("in 30d");
    expect((await one<{ d: string }>("SELECT due_date::text AS d FROM orders WHERE id = $1", [orders.late])).d).toBe(due);
  });

  test("orders: changing Client clears Delivery Docket, and docket choices are that client's", async ({ page }) => {
    await one("UPDATE orders SET delivery_docket_id = $1 WHERE id = $2", [fx.docketId, orders.arch]);
    try {
      await page.goto(`/orders?item=${orders.arch}`);
      const p = panel(page, "Edit order");
      const docket = p.getByRole("combobox", { name: "Delivery Docket", exact: true });
      await expect(docket).toContainText(docketNumber(fx.docketId));
      await pickReference(page, "Client", fx.names.otherClient, fx.names.otherClient, p);
      await expect(docket).not.toContainText(docketNumber(fx.docketId));
      await docket.click();
      await expect(page.getByRole("option", { name: docketNumber(fx.otherDocketId), exact: true })).toBeVisible();
      await expect(page.getByRole("option", { name: docketNumber(fx.docketId), exact: true })).toHaveCount(0);
      await page.keyboard.press("Escape");
    } finally {
      await one("UPDATE orders SET delivery_docket_id = NULL, client_id = $1 WHERE id = $2", [fx.clientId, orders.arch]);
    }
  });

  test("orders: a docket that now belongs to another client is refused with the error toast", async ({ page }) => {
    await page.goto(`/orders?item=${orders.done}`);
    const p = panel(page, "Edit order");
    await pickReference(page, "Delivery Docket", docketNumber(fx.docketId), docketNumber(fx.docketId), p);
    await one("UPDATE delivery_dockets SET to_client_id = $1 WHERE id = $2", [fx.otherClientId, fx.docketId]);
    try {
      await saveBtn(page, "Edit order").click();
      await expect(page.getByText("Could not edit Order: delivery docket belongs to another client", { exact: true })).toBeVisible();
      await expect(p).toBeVisible();
      expect((await one<{ d: string | null }>("SELECT delivery_docket_id AS d FROM orders WHERE id = $1", [orders.done])).d).toBeNull();
    } finally {
      await one("UPDATE delivery_dockets SET to_client_id = $1 WHERE id = $2", [fx.clientId, fx.docketId]);
    }
  });

  test("delivery dockets: read-only values, To client link, and a To Client change persists", async ({ page }) => {
    await page.goto(`/delivery-dockets?item=${archivedDocketId}`);
    const p = panel(page, "Edit delivery docket");
    for (const label of ["Docket Number", "Date", "From Client"]) await expect(p.getByLabel(label, { exact: true })).toHaveAttribute("readonly", "");
    await expect(p.getByLabel("Docket Number", { exact: true })).toHaveValue(docketNumber(archivedDocketId));
    await expect(p.getByRole("link", { name: fx.names.client, exact: true })).toHaveAttribute("href", `/clients/${fx.clientId}`);
    await pickReference(page, "To Client", fx.names.otherClient, fx.names.otherClient, p);
    await saveBtn(page, "Edit delivery docket").click();
    await expect(page.getByText("Delivery Docket successfully updated", { exact: true })).toBeVisible();
    expect(Number((await one<{ c: string }>("SELECT to_client_id AS c FROM delivery_dockets WHERE id = $1", [archivedDocketId])).c)).toBe(fx.otherClientId);
    await one("UPDATE delivery_dockets SET to_client_id = $1 WHERE id = $2", [fx.clientId, archivedDocketId]);

    // Spec 09 AC-3: with an order for the docket's client on it, the To Client can't move away.
    const heldOrder = await newId(
      "INSERT INTO orders (client_id, order_number, due_date, delivery_docket_id) VALUES ($1, $2, '2027-01-01', $3) RETURNING id",
      [fx.clientId, `${fx.tag}-HELD`, archivedDocketId],
    );
    try {
      await page.goto(`/delivery-dockets?item=${archivedDocketId}`);
      await pickReference(page, "To Client", fx.names.otherClient, fx.names.otherClient, p);
      await saveBtn(page, "Edit delivery docket").click();
      await expect(page.getByText("Could not edit Delivery Docket: delivery docket has orders for another client", { exact: true })).toBeVisible();
      await expect(p).toBeVisible();
      expect(Number((await one<{ c: string }>("SELECT to_client_id AS c FROM delivery_dockets WHERE id = $1", [archivedDocketId])).c)).toBe(fx.clientId);
    } finally {
      await one("DELETE FROM orders WHERE id = $1", [heldOrder]);
    }
  });
});

test.describe("07 AC-10 moved out of the tab", () => {
  test("orders: New → Complete shows Moved to Complete with View", async ({ page }) => {
    await page.goto(`/orders?client=${fx.clientId}&status=new&item=${orders.soon}`);
    const p = panel(page, "Edit order");
    await p.getByRole("radiogroup", { name: "Status" }).getByRole("radio", { name: "Complete" }).click();
    await saveBtn(page, "Edit order").click();
    await expect(page.getByText("Order successfully updated. Moved to Complete.", { exact: true })).toBeVisible();
    await expect(rowWith(page, `${fx.tag}-SOON`)).toHaveCount(0);
    await page.getByRole("button", { name: "View" }).click();
    await expect(page).toHaveURL(/status=complete/);
    await expect(page).toHaveURL(new RegExp(`item=${orders.soon}`));
    await expect(panel(page, "Edit order")).toBeVisible();
    await one("UPDATE orders SET status = 'new' WHERE id = $1", [orders.soon]);
  });

  test("delivery dockets: Current → Archived shows Moved to Archived with View", async ({ page }) => {
    await page.goto(`/delivery-dockets?to_client=${encodeURIComponent(fx.names.client)}&status=current&item=${fx.docketId}`);
    const p = panel(page, "Edit delivery docket");
    await p.getByRole("radiogroup", { name: "Status" }).getByRole("radio", { name: "Archived" }).click();
    await saveBtn(page, "Edit delivery docket").click();
    await expect(page.getByText("Delivery Docket successfully updated. Moved to Archived.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "View" }).click();
    await expect(page).toHaveURL(/status=archived/);
    await expect(panel(page, "Edit delivery docket")).toBeVisible();
    await one("UPDATE delivery_dockets SET status = 'current' WHERE id = $1", [fx.docketId]);
  });
});

test.describe("07 AC-11 products and product categories", () => {
  test("products: changing Category persists", async ({ page }) => {
    await page.goto(`/products?item=${fx.productId}`);
    const p = panel(page, "Edit product");
    await pickReference(page, "Category", `${fx.tag} Cat2`, `${fx.tag} Cat2`, p);
    await saveBtn(page, "Edit product").click();
    await expect(page.getByText("Product successfully updated", { exact: true })).toBeVisible();
    expect(Number((await one<{ c: string }>("SELECT category_id AS c FROM products WHERE id = $1", [fx.productId])).c)).toBe(cat2Id);
    await one("UPDATE products SET category_id = $1 WHERE id = $2", [fx.categoryId, fx.productId]);
  });

  test("product categories: form heading, 13 collapsed sections, a flag save, and an empty Name error", async ({ page }) => {
    await page.goto(`/product-categories?item=${fx.categoryId}`);
    const p = panel(page, "Edit product category");
    await expect(p.getByText("Columns to show on Order Items page (for this category)")).toBeVisible();
    const sections = p.locator("button[aria-expanded]");
    await expect(sections).toHaveCount(13);
    for (const s of await sections.all()) await expect(s).toHaveAttribute("aria-expanded", "false");
    await p.getByRole("button", { name: /^Statuses/ }).click();
    await setSwitch(page, "Cut Status", true);
    await saveBtn(page, "Edit product category").click();
    await expect(page.getByText("Product Category successfully updated", { exact: true })).toBeVisible();
    expect((await one<{ v: boolean }>("SELECT show_cut_status AS v FROM product_categories WHERE id = $1", [fx.categoryId])).v).toBe(true);

    await page.goto(`/product-categories?item=${fx.categoryId}`);
    await panel(page, "Edit product category").getByLabel("Name", { exact: true }).fill("");
    await saveBtn(page, "Edit product category").click();
    await expect(fieldError(page, "name")).toBeVisible();
    await expect(panel(page, "Edit product category").getByLabel("Name", { exact: true })).toBeFocused();
    expect((await one<{ n: string }>("SELECT name AS n FROM product_categories WHERE id = $1", [fx.categoryId])).n).toBe(fx.names.category);
  });
});

test.describe("07 AC-12 users", () => {
  test("heading and link fall back to the email; name saves; blank name → NULL; password rules", async ({ page }) => {
    await page.goto(`/users?email=${fx.tag}`);
    await expect(rowWith(page, userEmail).getByRole("link", { name: userEmail, exact: true })).toBeVisible();
    await page.goto(`/users?email=${fx.tag}&item=${userId}`);
    const p = panel(page, "Edit user");
    await expect(p.getByRole("heading", { level: 2 })).toHaveText(userEmail);
    await p.getByLabel("Name", { exact: true }).fill("Pat Panel");
    await saveBtn(page, "Edit user").click();
    await expect(page.getByText("User successfully updated", { exact: true })).toBeVisible();
    expect(await one("SELECT name, password_hash FROM users WHERE id = $1", [userId])).toEqual({ name: "Pat Panel", password_hash: "hash-before" });

    await page.goto(`/users?email=${fx.tag}&item=${userId}`);
    await expect(panel(page, "Edit user").getByRole("heading", { level: 2 })).toHaveText("Pat Panel");
    await panel(page, "Edit user").getByLabel("Name", { exact: true }).fill("");
    await panel(page, "Edit user").getByLabel("Password", { exact: true }).fill("short");
    await saveBtn(page, "Edit user").click();
    await expect(fieldError(page, "password")).toBeVisible();
    await panel(page, "Edit user").getByLabel("Password", { exact: true }).fill("");
    await saveBtn(page, "Edit user").click();
    await expect(page.getByText("User successfully updated", { exact: true })).toBeVisible();
    expect(await one("SELECT name, password_hash FROM users WHERE id = $1", [userId])).toEqual({ name: null, password_hash: "hash-before" });
  });
});

test.describe("07 AC-13 errors in collapsed sections", () => {
  test("order items: an error in collapsed Details expands it, counts it and focuses the field", async ({ page }) => {
    await page.goto(`/order-items?item=${itemA}`);
    const p = panel(page, "Edit order item");
    const details = p.getByRole("button", { name: /^Details/ });
    await details.click();
    await p.getByLabel("Part Number", { exact: true }).fill("");
    await details.click();
    await saveBtn(page, "Edit order item").click();
    await expect(details).toHaveAttribute("aria-expanded", "true");
    await expect(details).toContainText("1 error");
    await expect(p.getByLabel("Part Number", { exact: true })).toBeFocused();
  });
});

test.describe("07 AC-14 closing, focus, links, sheet", () => {
  test("clients: discard guard, focus return, View client", async ({ page }) => {
    const l = list("clients");
    await page.goto(`${l.path}?${l.query()}`);
    const link = rowWith(page, l.title()).getByRole("link", { name: l.title(), exact: true });
    await link.click();
    const p = panel(page, l.region);
    await expect(p.getByRole("heading", { level: 2 })).toBeFocused();
    await expect(p.getByRole("link", { name: /View client/ })).toHaveAttribute("href", `/clients/${fx.clientId}`);
    await page.keyboard.press("Escape");
    await expect(p).toBeHidden();
    await expect(link).toBeFocused();

    await link.click();
    await p.getByLabel("Fax", { exact: true }).fill("123");
    for (const close of [
      () => p.getByRole("button", { name: "Cancel" }).click(),
      () => p.getByRole("button", { name: "Close" }).click(),
      () => page.keyboard.press("Escape"),
    ]) {
      await close();
      const dialog = page.getByRole("alertdialog", { name: "Discard changes?" });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Keep editing" }).click();
      await expect(p.getByLabel("Fax", { exact: true })).toHaveValue("123");
    }
    await p.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("alertdialog", { name: "Discard changes?" }).getByRole("button", { name: "Discard" }).click();
    await expect(p).toBeHidden();
    await expect(page).not.toHaveURL(/item=/);
  });

  test("review 07 finding 1: focus returns to the visible row link when a hidden list has the same id", async ({ page }) => {
    // A client and an order with the same id; the Orders list stays mounted (hidden) after client-side navigation.
    const sharedId = 900_000_000 + Math.floor(Math.random() * 90_000_000);
    await withDb(async (c) => {
      await c.query("INSERT INTO clients (id, name) OVERRIDING SYSTEM VALUE VALUES ($1, $2)", [sharedId, `${fx.tag} Shared`]);
      await c.query("INSERT INTO orders (id, client_id, order_number, due_date) OVERRIDING SYSTEM VALUE VALUES ($1, $2, $3, '2027-01-01')", [
        sharedId, fx.clientId, `${fx.tag}-SHARED`,
      ]);
    });
    await page.goto(`/orders?order_number=${fx.tag}-SHARED`);
    await expect(page.locator(`[data-item-link="${sharedId}"]`)).toHaveCount(1);
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Clients" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Clients" })).toBeVisible();
    await page.getByRole("region", { name: "Filters" }).getByLabel("Name", { exact: true }).fill(`${fx.tag} Shared`);
    const link = rowWith(page, `${fx.tag} Shared`).getByRole("link", { name: `${fx.tag} Shared`, exact: true });
    await expect(link).toBeVisible();
    // The scenario: the hidden Orders list still holds a link with the same id, earlier in the DOM or not.
    await expect(page.locator(`[data-item-link="${sharedId}"]`)).toHaveCount(2);
    await link.click();
    await expect(panel(page, "Edit client")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel(page, "Edit client")).toBeHidden();
    await expect(link).toBeFocused();
  });

  test("below 1024px the panel is a sheet", async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 800 });
    await page.goto(`/clients?item=${fx.clientId}`);
    const sheet = page.getByRole("dialog", { name: "Edit client" });
    await expect(sheet).toBeVisible();
    // The sheet also has a screen-reader title (h2 "Edit client"), so match the record heading by name.
    await expect(sheet.getByRole("heading", { level: 2, name: fx.names.client, exact: true })).toBeVisible();
  });

  test("orders: switching tab keeps the panel and its unsaved edits", async ({ page }) => {
    await page.goto(`/orders?client=${fx.clientId}&item=${orders.done}`);
    const p = panel(page, "Edit order");
    await p.getByLabel("Order Number", { exact: true }).fill(`${fx.tag}-DONE-EDITED`);
    await tab(page, "Archived").click();
    await expect(page).toHaveURL(/status=archived/);
    await expect(p).toBeVisible();
    await expect(p.getByLabel("Order Number", { exact: true })).toHaveValue(`${fx.tag}-DONE-EDITED`);
  });
});

/** Visits the dashboard, then the list, so history has a page before the list. */
async function fromDashboard(page: Page, url: string) {
  await page.goto("/");
  await page.goto(url);
}

const FIX2: { name: string; url: () => string; region: string; open: (page: Page) => Promise<void>; openOther: (page: Page) => Promise<void>; edit: (page: Page) => Promise<string>; directId: () => number }[] = [
  {
    name: "order items",
    url: () => `/order-items?order=${orders.soon}`,
    region: "Edit order item",
    // The list is filtered to the SOON order, which holds exactly items A and B.
    open: (page) => page.getByRole("row").nth(1).getByRole("cell").last().click(),
    openOther: (page) => page.getByRole("row").nth(2).getByRole("cell").last().click(),
    edit: async (page) => {
      await panel(page, "Edit order item").getByLabel("Quantity", { exact: true }).fill("3");
      return "3";
    },
    directId: () => itemA,
  },
  {
    name: "clients",
    url: () => `/clients?name=${fx.tag}`,
    region: "Edit client",
    open: (page) => rowWith(page, fx.names.client).first().getByRole("cell").last().click(),
    openOther: (page) => rowWith(page, fx.names.otherClient).first().getByRole("cell").last().click(),
    edit: async (page) => {
      await panel(page, "Edit client").getByLabel("Phone", { exact: true }).fill("0411 000 999");
      return "0411 000 999";
    },
    directId: () => fx.clientId,
  },
];

test.describe("07 AC-17 fix 2: Back after closing", () => {
  for (const f of FIX2) {
    test(`${f.name}: Cancel or Save, then one Back leaves the list; the row shows the saved value`, async ({ page }) => {
      await fromDashboard(page, f.url());
      await f.open(page);
      await expect(panel(page, f.region)).toBeVisible();
      await panel(page, f.region).getByRole("button", { name: "Cancel" }).click();
      await expect(panel(page, f.region)).toBeHidden();
      await page.goBack();
      await expect(page).toHaveURL(/\/$/);

      await fromDashboard(page, f.url());
      await f.open(page);
      const value = await f.edit(page);
      await saveBtn(page, f.region).click();
      await expect(panel(page, f.region)).toBeHidden();
      await expect(page.getByRole("cell", { name: value, exact: true }).first()).toBeVisible();
      await page.goBack();
      await expect(page).toHaveURL(/\/$/);
    });

    test(`${f.name}: a direct load closes onto the list; a stale marker never leaves the app`, async ({ page }) => {
      const base = f.url().split("?")[0];
      await page.goto(`${base}?item=${f.directId()}`);
      await panel(page, f.region).getByRole("button", { name: "Close" }).click();
      await expect(panel(page, f.region)).toBeHidden();
      await expect(page).toHaveURL(new RegExp(`${base}$`));

      // Open from the list, navigate away with the panel open, then load the panel URL directly.
      await page.goto(f.url());
      await f.open(page);
      await expect(panel(page, f.region)).toBeVisible();
      const panelUrl = page.url();
      await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Dashboard" }).click();
      await expect(page).toHaveURL(/\/$/);
      await page.goto(panelUrl);
      await panel(page, f.region).getByRole("button", { name: "Close" }).click();
      await expect(panel(page, f.region)).toBeHidden();
      await expect(page).toHaveURL(new RegExp(`${base}\\?`));
      await expect(page).not.toHaveURL(/item=/);
    });

    test(`${f.name}: Back closes an open panel; switching rows then Cancel lands on the list`, async ({ page }) => {
      await fromDashboard(page, f.url());
      await f.open(page);
      await expect(panel(page, f.region)).toBeVisible();
      await page.goBack();
      await expect(panel(page, f.region)).toBeHidden();
      await expect(page).not.toHaveURL(/item=/);

      await f.open(page);
      await expect(panel(page, f.region)).toBeVisible();
      const first = page.url();
      await f.openOther(page);
      await expect(page).not.toHaveURL(first);
      await expect(panel(page, f.region)).toBeVisible();
      await panel(page, f.region).getByRole("button", { name: "Cancel" }).click();
      await expect(panel(page, f.region)).toBeHidden();
      await expect(page).not.toHaveURL(/item=/);
      await page.goBack();
      await expect(page).toHaveURL(/\/$/);
    });
  }
});

/** A page whose app scripts are blocked: the server HTML, its stylesheets and inline streaming scripts only. */
async function serverOnlyPage(browser: Browser, width: number) {
  const context = await browser.newContext({ storageState: "tests/e2e/.auth/user.json", viewport: { width, height: 800 } });
  const page = await context.newPage();
  // Only JavaScript chunks: Next serves the stylesheets from the same folder, and they must load.
  await page.route(/\/_next\/static\/chunks\/[^?]*\.js(\?|$)/, (r) => r.abort());
  return { page, context };
}

test.describe("07 AC-18 fix 3: no side panel flash below 1024px", () => {
  for (const [path, id, region] of [
    ["/order-items", () => itemA, "Edit order item"],
    ["/clients", () => fx.clientId, "Edit client"],
  ] as const) {
    test(`${path}: before hydration the side panel is hidden at 800px and shown at 1280px`, async ({ browser }) => {
      const narrow = await serverOnlyPage(browser, 800);
      await narrow.page.goto(`${path}?item=${id()}`);
      await expect(narrow.page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(narrow.page.locator(`section[aria-label="${region}"]`)).toHaveCount(1);
      await expect(narrow.page.locator(`section[aria-label="${region}"]`)).toBeHidden();
      await narrow.context.close();

      const wide = await serverOnlyPage(browser, 1280);
      await wide.page.goto(`${path}?item=${id()}`);
      await expect(wide.page.locator(`section[aria-label="${region}"]`)).toBeVisible();
      await wide.context.close();
    });
  }
});
