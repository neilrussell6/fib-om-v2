import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createFixture, type Fixture, removeFixture } from "../helpers/fixtures";
import { withDb } from "../helpers/test-db";

// Spec 06: the edit panel's query (AC-18) and Server Actions (AC-19–AC-23, AC-27).
const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string } } }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  auth: async () => session.current,
  requireSession: async () => {
    if (!session.current) throw new Error("NEXT_REDIRECT /login");
    return session.current;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// Spy on the allowlisted writer: the order fields must never reach it (Design → Save, step 2).
vi.mock("@/lib/db/records", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/db/records")>();
  return { ...mod, updateRecord: vi.fn(mod.updateRecord) };
});

const actions = () => import("@/lib/order-items/panel-actions");
const queries = () => import("@/lib/order-items/panel-queries");

let fx: Fixture;
let secondItemId: number;
let otherOrderId: number;
let otherCategoryId: number;
let otherProductId: number;

const one = <T = Record<string, unknown>>(text: string, params: unknown[] = []) =>
  withDb(async (c) => (await c.query(text, params)).rows[0] as T);

beforeAll(async () => {
  fx = await createFixture();
  // The fixture's category shows Cut and Package only.
  await one("UPDATE product_categories SET show_cut_status = true, show_package_status = true WHERE id = $1", [fx.categoryId]);
  secondItemId = Number(
    (
      await one<{ id: string }>(
        "INSERT INTO order_items (order_id, product_id, part_number, quantity, height, width, depth) VALUES ($1, $2, $3, 5, 1, 1, 1) RETURNING id",
        [fx.orderId, fx.productId, `${fx.tag}-PN2`],
      )
    ).id,
  );
  otherOrderId = Number(
    (
      await one<{ id: string }>(
        "INSERT INTO orders (client_id, order_number, due_date, status) VALUES ($1, $2, '2027-03-01', 'new') RETURNING id",
        [fx.otherClientId, `${fx.tag}-ORD2`],
      )
    ).id,
  );
  otherCategoryId = Number(
    (await one<{ id: string }>("INSERT INTO product_categories (name, show_frame_status) VALUES ($1, true) RETURNING id", [`${fx.tag} Cat2`])).id,
  );
  otherProductId = Number(
    (
      await one<{ id: string }>(
        "INSERT INTO products (name, category_id, type_id, size_id, media_id) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [`${fx.tag} Product2`, otherCategoryId, fx.typeId, fx.sizeId, fx.mediaId],
      )
    ).id,
  );
});
afterAll(() => removeFixture(fx.tag));
beforeEach(() => {
  session.current = { user: { id: "1", email: "panel@example.com" } };
});

/** Every item form field from the stored row, plus the order fields, as the panel submits them. */
async function panelValues(itemId: number, overrides: Record<string, unknown> = {}) {
  const { getOrderItemPanel } = await queries();
  const { initialValues } = await import("@/lib/resources/schema");
  const row = (await getOrderItemPanel(itemId))!;
  return {
    ...initialValues("order_items", row),
    order_due_date: row.order_due_date,
    order_status: row.order_status,
    ...overrides,
  };
}

describe("06 AC-18 getOrderItemPanel", () => {
  it("returns the item with its line number, the order's item count, order fields and category stage flags", async () => {
    const { getOrderItemPanel } = await queries();
    const first = await getOrderItemPanel(fx.orderItemId);
    const second = await getOrderItemPanel(secondItemId);
    expect(first).toMatchObject({
      id: String(fx.orderItemId),
      line_number: 1,
      order_item_count: 2,
      order_number: fx.names.orderNumber,
      order_due_date: "2026-12-01",
      order_status: "new",
      product_name: fx.names.product,
      product_size_name: fx.names.size,
      client_name: fx.names.client,
    });
    expect(second).toMatchObject({ line_number: 2, order_item_count: 2 });
    expect(first?.stageFlags).toEqual({
      cut_status: true,
      sow_status: false,
      frame_status: false,
      media_status: false,
      wire_status: false,
      package_status: true,
      assemble_status: false,
    });
  });

  it.each([["abc"], ["1.5"], ["999999999"]])("returns null for %s", async (id) => {
    const { getOrderItemPanel } = await queries();
    expect(await getOrderItemPanel(id)).toBeNull();
  });
});

describe("06 AC-21 / AC-22 panel lookups", () => {
  it("getProductPanelInfo returns the product's size and its category's stage flags", async () => {
    const { getProductPanelInfo } = await actions();
    const info = await getProductPanelInfo(otherProductId);
    expect(info?.product_size_name).toBe(fx.names.size);
    expect(info?.stageFlags).toMatchObject({ frame_status: true, cut_status: false, package_status: false });
    expect(await getProductPanelInfo(999999999)).toBeNull();
  });

  it("getOrderPanelInfo returns the order's dates, status, item count and client", async () => {
    const { getOrderPanelInfo } = await actions();
    expect(await getOrderPanelInfo(otherOrderId)).toMatchObject({
      order_number: `${fx.tag}-ORD2`,
      order_due_date: "2027-03-01",
      order_status: "new",
      order_item_count: 0,
      client_id: String(fx.otherClientId),
      client_name: fx.names.otherClient,
    });
    expect(await getOrderPanelInfo(999999999)).toBeNull();
  });
});

describe("06 AC-19 – AC-23 saveOrderItemPanel", () => {
  it("AC-19 persists a quantity change with the update message", async () => {
    const { saveOrderItemPanel } = await actions();
    const r = await saveOrderItemPanel(fx.orderItemId, await panelValues(fx.orderItemId, { quantity: "7" }));
    expect(r).toMatchObject({ ok: true, message: "Order Item successfully updated", orderStatus: "new" });
    expect((await one<{ quantity: number }>("SELECT quantity FROM order_items WHERE id = $1", [fx.orderItemId])).quantity).toBe(7);
  });

  it("never passes the order fields to updateRecord", async () => {
    const records = await import("@/lib/db/records");
    const spy = vi.mocked(records.updateRecord);
    spy.mockClear();
    const { saveOrderItemPanel } = await actions();
    await saveOrderItemPanel(fx.orderItemId, await panelValues(fx.orderItemId, { order_due_date: "2026-12-05" }));
    expect(spy).toHaveBeenCalled();
    for (const call of spy.mock.calls) {
      expect(call[2]).not.toHaveProperty("order_due_date");
      expect(call[2]).not.toHaveProperty("order_status");
    }
  });

  it("AC-20 a due date or status change updates the order, seen by every item", async () => {
    const { saveOrderItemPanel } = await actions();
    const r = await saveOrderItemPanel(
      fx.orderItemId,
      await panelValues(fx.orderItemId, { order_due_date: "2026-12-24", order_status: "complete" }),
    );
    expect(r).toMatchObject({ ok: true, orderStatus: "complete" });
    expect(await one("SELECT due_date::text, status::text FROM orders WHERE id = $1", [fx.orderId])).toEqual({
      due_date: "2026-12-24",
      status: "complete",
    });
    const { getOrderItemPanel } = await queries();
    expect(await getOrderItemPanel(secondItemId)).toMatchObject({ order_due_date: "2026-12-24", order_status: "complete" });
  });

  it("AC-21 moving an item and changing Due in one save updates only the new order", async () => {
    const { saveOrderItemPanel } = await actions();
    const before = await one<{ due_date: string }>("SELECT due_date::text FROM orders WHERE id = $1", [fx.orderId]);
    const r = await saveOrderItemPanel(
      secondItemId,
      await panelValues(secondItemId, { order_id: String(otherOrderId), order_due_date: "2027-04-01", order_status: "new" }),
    );
    expect(r.ok).toBe(true);
    expect((await one<{ order_id: string }>("SELECT order_id FROM order_items WHERE id = $1", [secondItemId])).order_id).toBe(String(otherOrderId));
    expect((await one<{ due_date: string }>("SELECT due_date::text FROM orders WHERE id = $1", [otherOrderId])).due_date).toBe("2027-04-01");
    expect((await one<{ due_date: string }>("SELECT due_date::text FROM orders WHERE id = $1", [fx.orderId])).due_date).toBe(before.due_date);
  });

  it("AC-21 an unknown order is a field error on Order and writes nothing", async () => {
    const { saveOrderItemPanel } = await actions();
    const r = await saveOrderItemPanel(fx.orderItemId, await panelValues(fx.orderItemId, { order_id: "999999999", quantity: "99" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors?.order_id).toBeTruthy();
    expect((await one<{ quantity: number }>("SELECT quantity FROM order_items WHERE id = $1", [fx.orderItemId])).quantity).not.toBe(99);
  });

  it("AC-22 changing product keeps every stage value, and a hidden done stage can be cleared", async () => {
    const { saveOrderItemPanel } = await actions();
    // Cut is done; the new product's category hides Cut.
    await one("UPDATE order_items SET cut_status = true WHERE id = $1", [fx.orderItemId]);
    let r = await saveOrderItemPanel(fx.orderItemId, await panelValues(fx.orderItemId, { product_id: String(otherProductId) }));
    expect(r.ok).toBe(true);
    expect(await one("SELECT product_id, cut_status FROM order_items WHERE id = $1", [fx.orderItemId])).toEqual({
      product_id: String(otherProductId),
      cut_status: true,
    });
    r = await saveOrderItemPanel(fx.orderItemId, await panelValues(fx.orderItemId, { cut_status: false }));
    expect(r.ok).toBe(true);
    expect((await one<{ cut_status: boolean }>("SELECT cut_status FROM order_items WHERE id = $1", [fx.orderItemId])).cut_status).toBe(false);
  });

  it("AC-23 an invalid value returns field errors and writes nothing", async () => {
    const { saveOrderItemPanel } = await actions();
    const r = await saveOrderItemPanel(fx.orderItemId, await panelValues(fx.orderItemId, { part_number: "", quantity: "55" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors?.part_number).toBe("Required");
    expect((await one<{ quantity: number }>("SELECT quantity FROM order_items WHERE id = $1", [fx.orderItemId])).quantity).not.toBe(55);
  });

  it("AC-23 a failing order update rolls back the item update", async () => {
    const { saveOrderItemPanel } = await actions();
    await withDb(async (c) => {
      await c.query(`CREATE OR REPLACE FUNCTION ${fx.tag}_fail() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.due_date = '2099-12-31' THEN RAISE EXCEPTION 'forced failure'; END IF; RETURN NEW; END $$`);
      await c.query(`CREATE TRIGGER ${fx.tag}_fail BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION ${fx.tag}_fail()`);
    });
    try {
      const r = await saveOrderItemPanel(fx.orderItemId, await panelValues(fx.orderItemId, { quantity: "77", order_due_date: "2099-12-31" }));
      expect(r.ok).toBe(false);
      expect((await one<{ quantity: number }>("SELECT quantity FROM order_items WHERE id = $1", [fx.orderItemId])).quantity).not.toBe(77);
    } finally {
      await withDb(async (c) => {
        await c.query(`DROP TRIGGER IF EXISTS ${fx.tag}_fail ON orders`);
        await c.query(`DROP FUNCTION IF EXISTS ${fx.tag}_fail()`);
      });
    }
  });
});

describe("06 AC-27 sessions", () => {
  it("every panel action rejects calls without a session", async () => {
    session.current = null;
    const { saveOrderItemPanel, getProductPanelInfo, getOrderPanelInfo } = await actions();
    await expect(saveOrderItemPanel(fx.orderItemId, { quantity: "1" })).rejects.toThrow();
    await expect(getProductPanelInfo(fx.productId)).rejects.toThrow();
    await expect(getOrderPanelInfo(fx.orderId)).rejects.toThrow();
  });
});
