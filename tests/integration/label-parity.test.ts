import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFixture, type Fixture, removeFixture } from "../helpers/fixtures";
import { withDb } from "../helpers/test-db";

// Spec 09 P3 / AC-10: the label the server builds from a record's view row is exactly the
// label the combobox's own lookup (searchReferences by id) returns for that id.
let fx: Fixture;
beforeAll(async () => {
  fx = await createFixture();
  // Every reference field on the fixture rows has a value.
  await withDb((c) => c.query("UPDATE orders SET delivery_docket_id = $1 WHERE id = $2", [fx.docketId, fx.orderId]));
});
afterAll(() => removeFixture(fx.tag));

const KEYS = [
  "users", "clients", "product_categories", "product_types", "product_sizes", "product_media",
  "products", "orders", "order_items", "delivery_dockets",
] as const;

const fixtureId = (key: string): number | undefined =>
  ({ products: fx.productId, orders: fx.orderId, order_items: fx.orderItemId, delivery_dockets: fx.docketId })[key];

describe("09 AC-10 reference label parity", () => {
  it.each(KEYS)("%s: referenceLabel matches searchReferences for every reference field", async (key) => {
    const { getResource, referenceLabel } = await import("@/lib/resources");
    const { getRecord } = await import("@/lib/db/records");
    const { searchReferences } = await import("@/lib/db/reference-search");
    const refs = getResource(key).fields.filter((f) => f.type === "reference");
    if (!refs.length) return;
    const id = fixtureId(key);
    expect(id, `no fixture row for ${key}`).toBeDefined();
    const row = await getRecord(key, id!);
    expect(row).not.toBeNull();
    for (const field of refs) {
      const value = row![field.name];
      expect(value, `${key}.${field.name} has no value on the fixture row`).not.toBeNull();
      const [option] = await searchReferences(field.ref!, { id: String(value) });
      expect(referenceLabel(field, row!), `${key}.${field.name}`).toBe(option.label);
    }
  });
});
