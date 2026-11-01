import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFixture, type Fixture, removeFixture } from "../helpers/fixtures";
import { withDb } from "../helpers/test-db";

// Spec 06: status tabs (AC-13) and relative due (AC-15) on the order-items list query.

/** Today in the app's time zone as YYYY-MM-DD. */
const todayIn = (tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

let fx: Fixture;
let today: string;
const orders: Record<string, number> = {};

async function addOrder(name: string, status: string, due: string, items: number) {
  await withDb(async (c) => {
    const id = Number(
      (
        await c.query(
          "INSERT INTO orders (client_id, order_number, due_date, status) VALUES ($1, $2, $3, $4) RETURNING id",
          [fx.clientId, `${fx.tag}-${name}`, due, status],
        )
      ).rows[0].id,
    );
    orders[name] = id;
    for (let i = 0; i < items; i++) {
      await c.query(
        "INSERT INTO order_items (order_id, product_id, part_number, quantity, height, width, depth) VALUES ($1, $2, $3, 1, 1, 1, 1)",
        [id, fx.productId, `${fx.tag}-${name}-${i}`],
      );
    }
  });
}

beforeAll(async () => {
  fx = await createFixture(); // one order (new, due 2026-12-01) with one item
  const { APP_TIME_ZONE } = await import("@/lib/time");
  today = todayIn(APP_TIME_ZONE);
  await addOrder("today", "new", today, 1);
  await addOrder("overdue", "new", addDays(today, -2), 2);
  await addOrder("later", "complete", addDays(today, 10), 3);
  await addOrder("old", "archived", addDays(today, -40), 1);
});
afterAll(() => removeFixture(fx.tag));

const list = async (params: Record<string, unknown>) => {
  const { listRecords } = await import("@/lib/db/list-query");
  return listRecords("order_items", { filters: { client: String(fx.clientId) }, pageSize: 100, ...params });
};

describe("06 AC-13 status tabs", () => {
  it("filters by order status", async () => {
    const r = await list({ status: "complete" });
    expect(r.total).toBe(3);
    expect(r.rows.every((row) => row.order_status === "complete")).toBe(true);
  });

  it("ignores an unknown status (All)", async () => {
    const all = await list({});
    const unknown = await list({ status: "dispatched" });
    expect(all.total).toBe(8);
    expect(unknown.total).toBe(8);
  });

  it("counts by status under the other filters, ignoring the status", async () => {
    const { countByStatus } = await import("@/lib/db/list-query");
    expect(await countByStatus("order_items", { client: String(fx.clientId) })).toEqual({ new: 4, complete: 3, archived: 1 });
    expect(await countByStatus("order_items", { client: String(fx.clientId), order: String(orders.overdue) })).toEqual({
      new: 2,
      complete: 0,
      archived: 0,
    });
  });

  it("rejects status filtering for resources without status tabs", async () => {
    const { listRecords, countByStatus } = await import("@/lib/db/list-query");
    await expect(listRecords("clients", { status: "new" })).rejects.toThrow();
    await expect(countByStatus("clients", {})).rejects.toThrow();
  });
});

describe("06 AC-15 due_in_days", () => {
  it("is the due date minus today in Australia/Brisbane", async () => {
    const { APP_TIME_ZONE } = await import("@/lib/time");
    const run = async () => {
      const before = todayIn(APP_TIME_ZONE);
      const r = await list({});
      const byOrder = (name: string) => r.rows.find((row) => row.order_id === String(orders[name]) || Number(row.order_id) === orders[name]);
      const values = ["today", "overdue", "later"].map((n) => Number(byOrder(n)?.due_in_days));
      return { values, changed: before !== todayIn(APP_TIME_ZONE) || before !== today };
    };
    let result = await run();
    if (result.changed) result = await run(); // the date rolled over mid-test: retry once
    expect(result.values).toEqual([0, -2, 10]);
  });

  it("sorts by the new columns", async () => {
    for (const sort of ["product_name", "product_size_name", "quantity"]) {
      const r = await list({ sort, dir: "asc" });
      expect(r.sort).toBe(sort);
    }
  });
});
