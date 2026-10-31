import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFixture, type Fixture, removeFixture, SENDER_CLIENT_ID } from "../helpers/fixtures";
import { withDb } from "../helpers/test-db";

let fx: Fixture;
beforeAll(async () => {
  fx = await createFixture();
});
afterAll(() => removeFixture(fx.tag));

const nullability = (table: string) =>
  withDb(async (c) => {
    const r = await c.query(
      "SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
      [table],
    );
    return Object.fromEntries(r.rows.map((x: { column_name: string; is_nullable: string }) => [x.column_name, x.is_nullable === "NO"]));
  });

describe("AC-2 schema", () => {
  it("has every table and view", async () => {
    const names = await withDb(async (c) =>
      (await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")).rows.map(
        (r: { table_name: string }) => r.table_name,
      ),
    );
    for (const t of [
      "clients", "product_categories", "product_types", "product_sizes", "product_media", "products",
      "orders", "order_items", "delivery_dockets", "products_v", "orders_v", "order_items_v", "delivery_dockets_v",
    ]) expect(names, t).toContain(t);
  });

  it.each([
    ["clients", ["name"], ["full_name", "phone", "address_shipping", "abn", "fax"]],
    ["product_types", ["name", "code"], ["millimetres_per_pleat"]],
    ["product_media", ["name", "code"], ["pleat_spacing"]],
    ["products", ["name", "category_id", "type_id", "size_id", "media_id"], ["efficiency"]],
    ["orders", ["client_id", "order_number", "date", "due_date", "status"], ["delivery_docket_id"]],
    ["order_items", ["order_id", "product_id", "part_number", "quantity", "height", "width", "depth", "cut_status"], ["comment", "clip_type"]],
    ["delivery_dockets", ["from_client_id", "to_client_id", "date", "status"], []],
  ])("%s: NOT NULL %j, nullable %j", async (table, notNull, nullable) => {
    const cols = await nullability(table);
    for (const c of notNull) expect(cols[c], `${table}.${c}`).toBe(true);
    for (const c of nullable) expect(cols[c], `${table}.${c}`).toBe(false);
  });

  it("every foreign key is ON DELETE RESTRICT", async () => {
    const rules = await withDb(async (c) =>
      (await c.query(
        "SELECT tc.table_name, rc.delete_rule FROM information_schema.referential_constraints rc JOIN information_schema.table_constraints tc ON tc.constraint_name = rc.constraint_name WHERE tc.table_schema = 'public'",
      )).rows,
    );
    expect(rules.length).toBeGreaterThanOrEqual(10);
    for (const r of rules) expect(r.delete_rule, r.table_name).toBe("RESTRICT");
  });

  it("enums for order and docket status, with defaults", async () => {
    await withDb(async (c) => {
      const o = await c.query("INSERT INTO orders (client_id, order_number, due_date) VALUES ($1, $2, '2026-12-01') RETURNING status, date = current_date AS today", [fx.clientId, `${fx.tag}-default`]);
      expect(o.rows[0]).toEqual({ status: "new", today: true });
      const d = await c.query("INSERT INTO delivery_dockets (from_client_id, to_client_id) VALUES ($1, $2) RETURNING status, date = current_date AS today", [SENDER_CLIENT_ID, fx.clientId]);
      expect(d.rows[0]).toEqual({ status: "current", today: true });
      await expect(c.query("INSERT INTO orders (client_id, order_number, due_date, status) VALUES ($1, 'x', '2026-12-01', 'approved')", [fx.clientId])).rejects.toThrow();
    });
  });

  it("orders.client_id is NOT NULL", async () => {
    await withDb(async (c) => {
      await expect(c.query("INSERT INTO orders (order_number, due_date) VALUES ('x', '2026-12-01')")).rejects.toThrow(/null/i);
    });
  });

  it("docket 42 has docket_number 000042", async () => {
    await withDb(async (c) => {
      await c.query("DELETE FROM delivery_dockets WHERE id = 42");
      const r = await c.query(
        "INSERT INTO delivery_dockets (id, from_client_id, to_client_id) VALUES (42, $1, $2) RETURNING docket_number",
        [SENDER_CLIENT_ID, fx.clientId],
      );
      expect(r.rows[0].docket_number).toBe("000042");
      await c.query("DELETE FROM delivery_dockets WHERE id = 42");
    });
  });
});

describe("AC-3 no new data rules", () => {
  it("duplicate order numbers save, for the same and different clients", async () => {
    await withDb(async (c) => {
      const n = `${fx.tag}-DUP`;
      for (const client of [fx.clientId, fx.clientId, fx.otherClientId]) {
        await c.query("INSERT INTO orders (client_id, order_number, due_date) VALUES ($1, $2, '2026-12-01')", [client, n]);
      }
      expect((await c.query("SELECT count(*)::int AS n FROM orders WHERE order_number = $1", [n])).rows[0].n).toBe(3);
    });
  });

  it("quantity -1 and height 0 save", async () => {
    await withDb(async (c) => {
      await c.query(
        "INSERT INTO order_items (order_id, product_id, part_number, quantity, height, width, depth) VALUES ($1, $2, $3, -1, 0, 1, 1)",
        [fx.orderId, fx.productId, `${fx.tag}-neg`],
      );
    });
  });
});

describe("AC-4 trigram indexes", () => {
  it("every filtered or searched text column has a pg_trgm GIN index", async () => {
    const { TEXT_SEARCH_COLUMNS } = await import("@/lib/db/queries");
    const indexed = await withDb(async (c) =>
      (await c.query("SELECT tablename, indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexdef ILIKE '%gin_trgm_ops%'")).rows,
    );
    expect(TEXT_SEARCH_COLUMNS.length).toBeGreaterThan(5);
    for (const { table, column } of TEXT_SEARCH_COLUMNS) {
      const hit = indexed.some((i: { tablename: string; indexdef: string }) => i.tablename === table && i.indexdef.includes(`(${column} gin_trgm_ops)`));
      expect(hit, `${table}.${column}`).toBe(true);
    }
  });
});
