import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createFixture, type Fixture, removeFixture, SENDER_CLIENT_ID } from "../helpers/fixtures";
import { withDb } from "../helpers/test-db";

// Spec 07: status tabs on orders and dockets (AC-2/AC-3), the orders due_in_days (AC-5),
// fix 1 for the order-item panel (AC-16), and saveRecord as the panels use it (AC-8, AC-12).
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

const todayIn = (tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const one = <T = Record<string, unknown>>(text: string, params: unknown[] = []) =>
  withDb(async (c) => (await c.query(text, params)).rows[0] as T);
const id = async (text: string, params: unknown[]) => Number((await one<{ id: string }>(text, params)).id);

let fx: Fixture;
let today: string;
const orders: Record<string, number> = {};
let archivedDocketId: number;

beforeAll(async () => {
  fx = await createFixture(); // one new order (due 2026-12-01); dockets: one current for client, one for other client
  const { APP_TIME_ZONE } = await import("@/lib/time");
  today = todayIn(APP_TIME_ZONE);
  const order = (n: string, status: string, due: string) =>
    id("INSERT INTO orders (client_id, order_number, due_date, status) VALUES ($1, $2, $3, $4) RETURNING id", [
      fx.clientId, `${fx.tag}-${n}`, due, status,
    ]);
  orders.today = await order("TODAY", "new", today);
  orders.overdue = await order("LATE", "new", addDays(today, -2));
  orders.later = await order("LATER", "complete", addDays(today, 10));
  orders.old = await order("OLD", "archived", addDays(today, -40));
  archivedDocketId = await id(
    "INSERT INTO delivery_dockets (from_client_id, to_client_id, status) VALUES ($1, $2, 'archived') RETURNING id",
    [SENDER_CLIENT_ID, fx.clientId],
  );
});
afterAll(() => removeFixture(fx.tag));
beforeEach(() => {
  session.current = { user: { id: "1", email: "panels@example.com" } };
});

const listQuery = () => import("@/lib/db/list-query");

describe("07 AC-2 / AC-3 status tabs on orders and delivery dockets", () => {
  it("orders filter by status under the other filters", async () => {
    const { listRecords } = await listQuery();
    const r = await listRecords("orders", { filters: { client: String(fx.clientId) }, status: "new", pageSize: 100 });
    expect(r.total).toBe(3); // fixture order + today + overdue
    expect(r.rows.every((row) => row.status === "new")).toBe(true);
  });

  it("orders ignore an unknown status (All)", async () => {
    const { listRecords } = await listQuery();
    const all = await listRecords("orders", { filters: { client: String(fx.clientId) }, pageSize: 100 });
    const unknown = await listRecords("orders", { filters: { client: String(fx.clientId) }, status: "current", pageSize: 100 });
    expect(all.total).toBe(5);
    expect(unknown.total).toBe(5);
  });

  it("orders count by status under the other filters", async () => {
    const { countByStatus } = await listQuery();
    expect(await countByStatus("orders", { client: String(fx.clientId) })).toEqual({ new: 3, complete: 1, archived: 1 });
    // order_number is a "contains" filter, so TODAY (not LATE, which also matches LATER).
    expect(await countByStatus("orders", { client: String(fx.clientId), order_number: `${fx.tag}-TODAY` })).toEqual({
      new: 1,
      complete: 0,
      archived: 0,
    });
  });

  it("delivery dockets filter and count by docket status", async () => {
    const { listRecords, countByStatus } = await listQuery();
    const filters = { to_client: fx.names.client };
    const current = await listRecords("delivery_dockets", { filters, status: "current", pageSize: 100 });
    expect(current.rows.map((r) => Number(r.id))).toEqual([fx.docketId]);
    const archived = await listRecords("delivery_dockets", { filters, status: "archived", pageSize: 100 });
    expect(archived.rows.map((r) => Number(r.id))).toEqual([archivedDocketId]);
    const unknown = await listRecords("delivery_dockets", { filters, status: "new", pageSize: 100 });
    expect(unknown.total).toBe(2);
    expect(await countByStatus("delivery_dockets", filters)).toEqual({ current: 1, archived: 1 });
  });

  it("order items still behave as in spec 06", async () => {
    const { countByStatus } = await listQuery();
    expect(await countByStatus("order_items", { order: String(fx.orderId) })).toEqual({ new: 1, complete: 0, archived: 0 });
  });

  it("rejects status filtering and counting for resources without status tabs", async () => {
    const { listRecords, countByStatus } = await listQuery();
    await expect(listRecords("clients", { status: "new" })).rejects.toThrow();
    await expect(countByStatus("products", {})).rejects.toThrow();
  });

  it("the old status filter is gone from orders and dockets", async () => {
    const { listRecords } = await listQuery();
    await expect(listRecords("orders", { filters: { status: "new" } })).rejects.toThrow(/Unknown filter/);
    await expect(listRecords("delivery_dockets", { filters: { status: "current" } })).rejects.toThrow(/Unknown filter/);
  });
});

describe("07 AC-5 orders due_in_days", () => {
  it("is the due date minus today in Australia/Brisbane", async () => {
    const { APP_TIME_ZONE } = await import("@/lib/time");
    const { listRecords } = await listQuery();
    const run = async () => {
      const before = todayIn(APP_TIME_ZONE);
      const r = await listRecords("orders", { filters: { client: String(fx.clientId) }, pageSize: 100 });
      const byId = (n: string) => r.rows.find((row) => Number(row.id) === orders[n]);
      const values = ["today", "overdue", "later"].map((n) => Number(byId(n)?.due_in_days));
      return { values, changed: before !== todayIn(APP_TIME_ZONE) || before !== today };
    };
    let result = await run();
    if (result.changed) result = await run();
    expect(result.values).toEqual([0, -2, 10]);
  });
});

describe("07 AC-16 fix 1: the order-item panel writes the order only when asked to", () => {
  /** The panel's values from the stored row, without the order fields (as the panel now sends them unless changed). */
  async function itemValues(itemId: number, overrides: Record<string, unknown> = {}) {
    const { getOrderItemPanel } = await import("@/lib/order-items/panel-queries");
    const { initialValues } = await import("@/lib/resources/schema");
    const row = (await getOrderItemPanel(itemId))!;
    return { ...initialValues("order_items", row), ...overrides };
  }

  it("a save without the order fields leaves an externally changed order untouched", async () => {
    const { saveOrderItemPanel } = await import("@/lib/order-items/panel-actions");
    const values = await itemValues(fx.orderItemId, { quantity: "8" });
    // A colleague changes the order after the panel opened.
    await one("UPDATE orders SET due_date = '2027-02-02', status = 'complete' WHERE id = $1", [fx.orderId]);
    const r = await saveOrderItemPanel(fx.orderItemId, values);
    expect(r).toMatchObject({ ok: true, orderStatus: "complete" }); // the stored status, for the moved-tab check
    expect(await one("SELECT due_date::text, status::text FROM orders WHERE id = $1", [fx.orderId])).toEqual({
      due_date: "2027-02-02",
      status: "complete",
    });
    expect((await one<{ quantity: number }>("SELECT quantity FROM order_items WHERE id = $1", [fx.orderItemId])).quantity).toBe(8);
  });

  it("a save with the order fields still updates the order", async () => {
    const { saveOrderItemPanel } = await import("@/lib/order-items/panel-actions");
    const r = await saveOrderItemPanel(
      fx.orderItemId,
      await itemValues(fx.orderItemId, { order_due_date: "2027-03-03", order_status: "new" }),
    );
    expect(r).toMatchObject({ ok: true, orderStatus: "new" });
    expect(await one("SELECT due_date::text, status::text FROM orders WHERE id = $1", [fx.orderId])).toEqual({
      due_date: "2027-03-03",
      status: "new",
    });
  });

  it("a present but invalid order field is still rejected", async () => {
    const { saveOrderItemPanel } = await import("@/lib/order-items/panel-actions");
    const r = await saveOrderItemPanel(fx.orderItemId, await itemValues(fx.orderItemId, { order_due_date: "soon", order_status: "new" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors?.order_due_date).toBeTruthy();
  });

  it("moving an item with Due updates only the new order", async () => {
    const { saveOrderItemPanel } = await import("@/lib/order-items/panel-actions");
    const itemId = await id(
      "INSERT INTO order_items (order_id, product_id, part_number, quantity, height, width, depth) VALUES ($1, $2, $3, 1, 1, 1, 1) RETURNING id",
      [orders.today, fx.productId, `${fx.tag}-MOVE`],
    );
    const before = await one<{ due_date: string }>("SELECT due_date::text FROM orders WHERE id = $1", [orders.today]);
    const r = await saveOrderItemPanel(
      itemId,
      await itemValues(itemId, { order_id: String(orders.overdue), order_due_date: "2027-05-05", order_status: "new" }),
    );
    expect(r.ok).toBe(true);
    expect((await one<{ due_date: string }>("SELECT due_date::text FROM orders WHERE id = $1", [orders.overdue])).due_date).toBe("2027-05-05");
    expect((await one<{ due_date: string }>("SELECT due_date::text FROM orders WHERE id = $1", [orders.today])).due_date).toBe(before.due_date);
  });
});

describe("07 AC-8 / AC-12 saveRecord as the panels use it", () => {
  it("refuses an order with another client's docket and writes nothing", async () => {
    const { saveRecord } = await import("@/lib/resources/actions");
    const before = await one("SELECT delivery_docket_id, due_date::text FROM orders WHERE id = $1", [orders.later]);
    const r = await saveRecord("orders", orders.later, {
      client_id: String(fx.clientId),
      order_number: `${fx.tag}-LATER`,
      due_date: "2027-06-06",
      status: "complete",
      delivery_docket_id: String(fx.otherDocketId),
    });
    expect(r).toEqual({ ok: false, error: "delivery docket belongs to another client" });
    expect(await one("SELECT delivery_docket_id, due_date::text FROM orders WHERE id = $1", [orders.later])).toEqual(before);
  });

  it("a users edit with a blank password keeps the hash; a blank name is stored as NULL", async () => {
    const { saveRecord } = await import("@/lib/resources/actions");
    const email = `${fx.tag}-panel-user@example.com`;
    const userId = await id("INSERT INTO users (email, password_hash, name) VALUES ($1, 'hash-before', 'Pat') RETURNING id", [email]);
    const r = await saveRecord("users", userId, { name: "   ", email, password: "" });
    expect(r.ok).toBe(true);
    expect(await one("SELECT name, password_hash FROM users WHERE id = $1", [userId])).toEqual({ name: null, password_hash: "hash-before" });
  });
});
