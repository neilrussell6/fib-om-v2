import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createFixture, type Fixture, removeFixture } from "../helpers/fixtures";
import { legacyListIds } from "../helpers/legacy-list-query";
import { withDb } from "../helpers/test-db";

// Spec 09 P1: listRecords reads a page of ids, then those rows, with the total from its own
// count. `query` is the real one, wrapped in a spy to see the SQL sent.
const sent = vi.hoisted(() => ({ sql: [] as string[] }));
vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...real,
    query: (text: string, params?: unknown[]) => {
      sent.sql.push(text);
      return real.query(text, params);
    },
  };
});

const KEYS = [
  "users", "clients", "product_categories", "product_types", "product_sizes", "product_media",
  "products", "orders", "order_items", "delivery_dockets",
] as const;

let fx: Fixture;
beforeAll(async () => {
  fx = await createFixture();
  await withDb(async (c) => {
    // 30 sizes, with duplicate names so the id tie-break decides the order.
    for (let i = 0; i < 30; i++) await c.query("INSERT INTO product_sizes (name) VALUES ($1)", [`${fx.tag} sz ${String(i % 10).padStart(2, "0")}`]);
  });
});
afterAll(() => removeFixture(fx.tag));
beforeEach(() => {
  sent.sql = [];
});

const load = () => import("@/lib/db/list-query");

describe("09 AC-6 listRecords: ids, then rows, then a separate count", () => {
  it("sends no SQL containing OVER (", async () => {
    const { listRecords } = await load();
    for (const key of KEYS) await listRecords(key, {});
    expect(sent.sql.length).toBeGreaterThan(0);
    expect(sent.sql.filter((s) => /OVER\s*\(/i.test(s))).toEqual([]);
  });

  it.each(KEYS)("%s: default sort returns the same rows in the same order as the old query", async (key) => {
    const { listRecords } = await load();
    const r = await listRecords(key, {});
    const old = await legacyListIds(key, {});
    expect(r.rows.map((x) => Number(x.id))).toEqual(old.ids);
    expect(r.total).toBe(old.total);
  });

  it.each(KEYS)("%s: an ascending and a descending column sort match the old query", async (key) => {
    const { listRecords } = await load();
    const { QUERIES } = await import("@/lib/db/queries");
    const sort = Object.keys(QUERIES[key].sorts)[0];
    for (const dir of ["asc", "desc"] as const) {
      const r = await listRecords(key, { sort, dir });
      expect(r.rows.map((x) => Number(x.id)), `${key} ${sort} ${dir}`).toEqual((await legacyListIds(key, { sort, dir })).ids);
    }
  });

  it("ties on the sort column are broken by id, as before (filtered, page 2)", async () => {
    const { listRecords } = await load();
    const r = await listRecords("product_sizes", { filters: { name: `${fx.tag} sz` }, sort: "name", dir: "asc", page: 2, pageSize: 10 });
    const old = await legacyListIds("product_sizes", {
      where: ["name ILIKE '%' || $1 || '%'"],
      values: [`${fx.tag} sz`],
      sort: "name",
      dir: "asc",
      page: 2,
      pageSize: 10,
    });
    expect(r.rows.map((x) => Number(x.id))).toEqual(old.ids);
    expect(r.total).toBe(30);
  });

  it("returns every selected column, as before", async () => {
    const { listRecords } = await load();
    const r = await listRecords("order_items", { filters: { part_number: fx.names.partNumber } });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ id: expect.anything(), part_number: fx.names.partNumber, client_name: fx.names.client });
    expect(r.rows[0]).toHaveProperty("due_in_days");
    expect(r.rows[0]).not.toHaveProperty("__total");
  });

  it("total equals SELECT count(*) under the same filters and status", async () => {
    const { listRecords } = await load();
    const r = await listRecords("orders", { filters: { client: String(fx.clientId) }, status: "new" });
    const n = await withDb(async (c) =>
      Number((await c.query("SELECT count(*)::int AS n FROM orders WHERE client_id = $1 AND status = 'new'", [fx.clientId])).rows[0].n),
    );
    expect(r.total).toBe(n);
  });
});

describe("09 AC-7 past the last page", () => {
  it("returns no rows and the real total", async () => {
    const { listRecords } = await load();
    const r = await listRecords("product_sizes", { filters: { name: `${fx.tag} sz` }, page: 999 });
    expect(r.rows).toEqual([]);
    expect(r.total).toBe(30);
    expect(r.page).toBe(999);
  });

  it("an empty result has total 0", async () => {
    const { listRecords } = await load();
    const r = await listRecords("product_sizes", { filters: { name: `${fx.tag} nothing-matches` } });
    expect(r).toMatchObject({ rows: [], total: 0 });
  });
});
