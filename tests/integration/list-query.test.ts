import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFixture, type Fixture, removeFixture } from "../helpers/fixtures";
import { withDb } from "../helpers/test-db";

let fx: Fixture;
beforeAll(async () => {
  fx = await createFixture();
  await withDb(async (c) => {
    for (let i = 0; i < 30; i++) await c.query("INSERT INTO product_sizes (name) VALUES ($1)", [`${fx.tag} size ${String(i).padStart(2, "0")}`]);
    await c.query("INSERT INTO clients (name) VALUES ($1)", [`${fx.tag} ACME Pty`]);
  });
});
afterAll(() => removeFixture(fx.tag));

const load = () => import("@/lib/db/list-query");

describe("AC-8 pagination", () => {
  it("defaults to 25 rows per page and reports the total", async () => {
    const { listRecords } = await load();
    const r = await listRecords("product_sizes", { filters: { name: fx.tag } });
    expect(r.pageSize).toBe(25);
    expect(r.rows).toHaveLength(25);
    expect(r.total).toBe(31);
  });

  it.each([10, 25, 50, 100])("accepts page size %i", async (n) => {
    const { normalisePageSize } = await load();
    expect(normalisePageSize(n)).toBe(n);
  });

  it.each([0, 7, 1000, Number.NaN])("falls back to 25 for %s", async (n) => {
    const { normalisePageSize } = await load();
    expect(normalisePageSize(n)).toBe(25);
  });

  it("page 2 continues where page 1 ended", async () => {
    const { listRecords } = await load();
    const p1 = await listRecords("product_sizes", { filters: { name: fx.tag }, pageSize: 10, page: 1 });
    const p2 = await listRecords("product_sizes", { filters: { name: fx.tag }, pageSize: 10, page: 2 });
    expect(p1.rows.map((r) => r.id)).not.toEqual(p2.rows.map((r) => r.id));
    expect(p2.rows).toHaveLength(10);
  });
});

describe("AC-7 sorting", () => {
  it("sorts by an allowlisted key in either direction", async () => {
    const { listRecords } = await load();
    const asc = await listRecords("product_sizes", { filters: { name: fx.tag }, sort: "name", dir: "asc", pageSize: 100 });
    const desc = await listRecords("product_sizes", { filters: { name: fx.tag }, sort: "name", dir: "desc", pageSize: 100 });
    const names = asc.rows.map((r) => String(r.name));
    expect(names).toEqual([...names].sort());
    expect(desc.rows.map((r) => r.name)).toEqual([...names].reverse());
  });

  it("uses the resource's default sort when none is given", async () => {
    const { listRecords } = await load();
    const r = await listRecords("product_types", {});
    expect([r.sort, r.dir]).toEqual(["code", "asc"]);
  });
});

describe("AC-11 contains, case-insensitive", () => {
  it("a search for 'cme' finds ACME", async () => {
    const { listRecords } = await load();
    const r = await listRecords("clients", { filters: { name: "cme" }, pageSize: 100 });
    expect(r.rows.map((x) => x.name)).toContain(`${fx.tag} ACME Pty`);
  });
});

describe("AC-23 product type filter uses type_id", () => {
  it("returns exactly the products with that type_id", async () => {
    const { listRecords } = await load();
    const r = await listRecords("products", { filters: { type: String(fx.typeId) } });
    expect(r.rows.map((x) => Number(x.id))).toEqual([fx.productId]);
  });
});

// Spec 09 T I3: the unknown filter and sort key cases are unit tests of the builder
// (tests/unit/list-query-builder.test.ts); injection stays here, against Postgres.
describe("AC-13 allowlists and injection", () => {
  it("treats an injection string in a filter value as data", async () => {
    const { listRecords } = await load();
    const before = await withDb(async (c) => (await c.query("SELECT count(*)::int AS n FROM clients")).rows[0].n);
    const r = await listRecords("clients", { filters: { name: "x'); DELETE FROM clients; --" } });
    expect(r.rows).toEqual([]);
    const after = await withDb(async (c) => (await c.query("SELECT count(*)::int AS n FROM clients")).rows[0].n);
    expect(after).toBe(before);
  });
});

describe("Range and enum filters", () => {
  // Spec 06: order status is the list's status tab (`status`), no longer an order-items filter key.
  it("filters order items by height range and order status", async () => {
    const { listRecords } = await load();
    const hit = await listRecords("order_items", { filters: { part_number: fx.tag, height_from: "400", height_to: "600" }, status: "new" });
    expect(hit.rows.map((x) => Number(x.id))).toEqual([fx.orderItemId]);
    const miss = await listRecords("order_items", { filters: { part_number: fx.tag, height_from: "501" } });
    expect(miss.rows).toEqual([]);
  });

  it("filters orders by created date range", async () => {
    const { listRecords } = await load();
    const today = new Date().toISOString().slice(0, 10);
    const r = await listRecords("orders", { filters: { order_number: fx.names.orderNumber, created_from: today, created_to: today } });
    expect(r.rows.map((x) => Number(x.id))).toEqual([fx.orderId]);
  });
});

// Spec 09 T I3: the other invalid-value and status cases are unit tests of the builder
// (tests/unit/list-query-builder.test.ts); one case stays here, against Postgres.
describe("Review 02 finding 1: invalid filter values are ignored, not sent to Postgres", () => {
  it("orders {\"created_from\":\"abc\"} lists unfiltered for that key", async () => {
    const { listRecords } = await load();
    const filtered = await listRecords("orders", { filters: { created_from: "abc" } });
    const unfiltered = await listRecords("orders", {});
    expect(filtered.total).toBe(unfiltered.total);
  });

  it("valid values still filter", async () => {
    const { listRecords } = await load();
    const r = await listRecords("orders", { filters: { client: String(fx.clientId) }, status: "new" });
    expect(r.rows.map((x) => Number(x.client_id))).toEqual(r.rows.map(() => fx.clientId));
  });
});
