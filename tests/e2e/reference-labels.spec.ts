import { expect, type Page, test } from "@playwright/test";
import { createFixture, type Fixture, removeFixture } from "../helpers/fixtures";
import { withDb } from "../helpers/test-db";
import { pickReference } from "./form-helpers";

// Spec 09 P3 / AC-11: reference comboboxes get their label from the server, so none fetches
// `/api/reference/*?id=` to label its current value.
let fx: Fixture;
test.beforeAll(async () => {
  fx = await createFixture();
  await withDb((c) => c.query("UPDATE orders SET delivery_docket_id = $1 WHERE id = $2", [fx.docketId, fx.orderId]));
});
test.afterAll(() => removeFixture(fx.tag));

const docketNumber = (id: number) => String(id).padStart(6, "0");

/** Records every reference-label request (`?id=`) the page makes. */
function idRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith("/api/reference/") && u.searchParams.has("id")) seen.push(r.url());
  });
  return seen;
}

test("09 AC-11 labels show at once, with no ?id= request, on direct loads and row clicks", async ({ page }) => {
  const seen = idRequests(page);

  // Order edit panel, direct load: Client and Delivery Docket.
  await page.goto(`/orders?item=${fx.orderId}`);
  const order = page.getByRole("region", { name: "Edit order" });
  await expect(order.getByRole("combobox", { name: "Client", exact: true })).toHaveText(fx.names.client);
  await expect(order.getByRole("combobox", { name: "Delivery Docket", exact: true })).toHaveText(docketNumber(fx.docketId));

  // Order edit panel, opened by a row click.
  await page.goto(`/orders?order_number=${fx.names.orderNumber}`);
  await page.getByRole("row").filter({ hasText: fx.names.orderNumber }).getByRole("cell").last().click();
  await expect(order.getByRole("combobox", { name: "Delivery Docket", exact: true })).toHaveText(docketNumber(fx.docketId));

  // Order-item panel: Order (number · client) and Product.
  await page.goto(`/order-items?item=${fx.orderItemId}`);
  const item = page.getByRole("region", { name: "Edit order item" });
  await expect(item.getByRole("combobox", { name: "Order", exact: true })).toHaveText(`${fx.names.orderNumber} · ${fx.names.client}`);
  await expect(item.getByRole("combobox", { name: "Product", exact: true })).toHaveText(fx.names.product);

  // A reference filter from the URL.
  await page.goto(`/orders?client=${fx.clientId}`);
  const filters = page.getByRole("region", { name: "Filters" });
  const client = filters.getByRole("combobox", { name: "Client", exact: true });
  await expect(client).toHaveText(fx.names.client);

  expect(seen).toEqual([]);

  // Choosing another option still shows its label; clearing the filter shows "Select…".
  await pickReference(page, "Client", fx.names.otherClient, fx.names.otherClient, filters);
  await expect(client).toHaveText(fx.names.otherClient);
  await filters.getByRole("button", { name: "Clear Client filter" }).click();
  await expect(client).toHaveText("Select…");
});
