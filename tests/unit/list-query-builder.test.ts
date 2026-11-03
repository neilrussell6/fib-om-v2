import { describe, expect, it } from "vitest";

// Spec 09 T I3: the list query's pure builder (lib/db/list-query.ts), unit tested without a
// database. These cases moved down from tests/integration/list-query.test.ts and
// list-panels.test.ts (see tests/MOVED.md); integration keeps "injection is data", "valid
// values still filter" and one invalid-value case.
const load = () => import("@/lib/db/list-query");

describe("Review 02 finding 1: invalid filter values are ignored, not sent to Postgres", () => {
  it.each([
    ["orders", { created_from: "abc" }],
    ["orders", { created_to: "2026-02-30" }],
    ["orders", { client: "abc" }],
    ["order_items", { height_from: "x" }],
    ["order_items", { width_to: "99999999999" }],
    ["products", { type: "1; DROP TABLE products" }],
  ] as const)("%s %j adds no condition", async (key, filters) => {
    const { filterWhere } = await load();
    expect(filterWhere(key, { ...filters })).toEqual({ where: [], values: [] });
  });

  it.each([
    ["orders", "approved"],
    ["delivery_dockets", "nope"],
  ] as const)("%s status %j adds no condition (All)", async (key, status) => {
    const { statusCondition } = await load();
    expect(statusCondition(key, status, 1)).toBeNull();
  });
});

describe("09 T I3 filterWhere", () => {
  it("valid values become numbered conditions, with the value as a parameter", async () => {
    const { filterWhere } = await load();
    const r = filterWhere("orders", { client: "5", created_from: "2026-01-31", order_number: "A_1%" });
    expect(r.values).toEqual(["5", "2026-01-31", "A\\_1\\%"]);
    expect(r.where).toEqual(["client_id = $1::bigint", "date >= $2::date", "order_number ILIKE '%' || $3 || '%'"]);
  });

  it("an injection string only ever reaches SQL as a parameter", async () => {
    const { filterWhere } = await load();
    const r = filterWhere("clients", { name: "x'); DELETE FROM clients; --" });
    expect(r.where).toEqual(["name ILIKE '%' || $1 || '%'"]);
    expect(r.where.join(" ")).not.toContain("DELETE");
  });

  it("skips blank values and trims the rest", async () => {
    const { filterWhere } = await load();
    expect(filterWhere("clients", { name: "   " })).toEqual({ where: [], values: [] });
    expect(filterWhere("clients", { name: "  acme " }).values).toEqual(["acme"]);
  });

  it("numbers its parameters after a given offset", async () => {
    const { filterWhere } = await load();
    expect(filterWhere("clients", { name: "a" }, 2).where).toEqual(["name ILIKE '%' || $3 || '%'"]);
  });
});

describe("AC-13 allowlists (moved from integration)", () => {
  it("rejects an unknown filter key", async () => {
    const { filterWhere, UnknownKeyError } = await load();
    expect(() => filterWhere("clients", { "name; DROP TABLE clients": "x" })).toThrow(UnknownKeyError);
  });

  it("rejects an unknown sort key", async () => {
    const { orderBy, UnknownKeyError } = await load();
    expect(() => orderBy("clients", "id; DROP TABLE clients")).toThrow(UnknownKeyError);
  });
});

describe("09 T I3 orderBy", () => {
  it("uses the resource's default sort and direction when none is given", async () => {
    const { orderBy } = await load();
    expect(orderBy("order_items")).toEqual({ sort: "order_due_date", dir: "desc", sql: "order_due_date DESC NULLS LAST, id DESC" });
  });

  it("an explicit sort defaults to ascending", async () => {
    const { orderBy } = await load();
    expect(orderBy("clients", "name")).toEqual({ sort: "name", dir: "asc", sql: "name ASC NULLS LAST, id ASC" });
    expect(orderBy("clients", "name", "desc").sql).toBe("name DESC NULLS LAST, id DESC");
  });
});

describe("07 AC-2 / AC-3 status rules (moved from integration list-panels)", () => {
  it("a known status becomes a cast condition", async () => {
    const { statusCondition } = await load();
    expect(statusCondition("orders", "new", 3)).toEqual({ condition: "status = $3::order_status", value: "new" });
    expect(statusCondition("order_items", "complete", 1)).toEqual({ condition: "order_status = $1::order_status", value: "complete" });
  });

  it("rejects status filtering for resources without status tabs", async () => {
    const { statusCondition, UnknownKeyError } = await load();
    expect(() => statusCondition("clients", "new", 1)).toThrow(UnknownKeyError);
    expect(() => statusCondition("products", "new", 1)).toThrow(UnknownKeyError);
  });

  it("the old status filter is gone from orders and dockets", async () => {
    const { filterWhere } = await load();
    expect(() => filterWhere("orders", { status: "new" })).toThrow(/Unknown filter/);
    expect(() => filterWhere("delivery_dockets", { status: "current" })).toThrow(/Unknown filter/);
  });
});
