import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SHOW_COLUMNS, V1_CATEGORIES } from "@/lib/data/v1-categories";
import { buildDataset, type Dataset, seedDummy } from "@/scripts/seed-dummy";
import { createThrowawayDb, type ThrowawayDb, withUrl } from "../helpers/throwaway-db";

// Spec 03 AC-1 to AC-5. Runs only against a throwaway database, never the shared test database.

const APP_TABLES = [
  "clients", "product_categories", "product_types", "product_sizes", "product_media", "products",
  "delivery_dockets", "orders", "order_items",
] as const;

let db: ThrowawayDb;
const q = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
  withUrl(db.url, async (c) => (await c.query(sql, params)).rows as T[]);
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await q<T>(sql, params))[0];
const seed = (dataset: Dataset) => withUrl(db.url, (c: pg.Client) => seedDummy(c, dataset));

/** Every app table's rows ordered by id; order and order-item ids replaced by their position. */
async function snapshot() {
  const out: Record<string, unknown[]> = {};
  for (const t of APP_TABLES) out[t] = await q(`SELECT * FROM ${t} ORDER BY id`);
  const orderPos = new Map(out.orders.map((o, i) => [String((o as { id: unknown }).id), i]));
  out.orders = out.orders.map((o) => ({ ...(o as object), id: undefined }));
  out.order_items = out.order_items.map((it) => {
    const row = it as { order_id: unknown };
    return { ...row, id: undefined, order_id: orderPos.get(String(row.order_id)) };
  });
  return out;
}

beforeAll(async () => {
  db = await createThrowawayDb();
}, 120_000);
afterAll(async () => {
  await db?.drop();
});

describe("AC-1 coverage", () => {
  beforeAll(async () => {
    await seed(buildDataset(1, 1));
  });

  it("fills every app table and leaves users and login_attempts alone", async () => {
    for (const t of APP_TABLES) {
      const { n } = await one<{ n: number }>(`SELECT count(*)::int AS n FROM ${t}`);
      expect(n, t).toBeGreaterThan(0);
    }
    expect((await one<{ n: number }>("SELECT count(*)::int AS n FROM users")).n).toBe(0);
    expect((await one<{ n: number }>("SELECT count(*)::int AS n FROM login_attempts")).n).toBe(0);
  });

  it("has the minimum row counts, with more than one page of clients, products, orders and order items", async () => {
    const counts = Object.fromEntries(
      await Promise.all(
        APP_TABLES.map(async (t) => [t, (await one<{ n: number }>(`SELECT count(*)::int AS n FROM ${t}`)).n] as const),
      ),
    );
    expect(counts.clients).toBeGreaterThanOrEqual(31);
    expect(counts.products).toBeGreaterThanOrEqual(60);
    expect(counts.orders).toBeGreaterThanOrEqual(60);
    expect(counts.order_items).toBeGreaterThanOrEqual(300);
    expect(counts.delivery_dockets).toBeGreaterThanOrEqual(20);
    for (const t of ["clients", "products", "orders", "order_items"]) expect(counts[t], t).toBeGreaterThan(25);
  });

  it("has the sender client with id FROM_CLIENT_ID", async () => {
    expect(await one("SELECT name FROM clients WHERE id = 1")).toEqual({ name: "Fibatron (dummy)" });
  });

  it("has every v1 category with v1's flags, plus the two dummy categories", async () => {
    const rows = await q<Record<string, unknown>>("SELECT * FROM product_categories");
    for (const v1 of V1_CATEGORIES) {
      const row = rows.find((r) => r.name === v1.name);
      expect(row, v1.name).toBeDefined();
      for (const col of SHOW_COLUMNS) expect(row?.[col], `${v1.name} ${col}`).toBe(v1.flags[col]);
    }
    const all = rows.find((r) => r.name === "Dummy All Columns");
    const none = rows.find((r) => r.name === "Dummy No Columns");
    for (const col of SHOW_COLUMNS) {
      expect(all?.[col], col).toBe(true);
      expect(none?.[col], col).toBe(false);
    }
    expect(rows).toHaveLength(V1_CATEGORIES.length + 2);
  });

  it("has every order status and docket status", async () => {
    const os = await q<{ s: string }>("SELECT DISTINCT status::text AS s FROM orders ORDER BY 1");
    expect(os.map((r) => r.s)).toEqual(["archived", "complete", "new"]);
    const ds = await q<{ s: string }>("SELECT DISTINCT status::text AS s FROM delivery_dockets ORDER BY 1");
    expect(ds.map((r) => r.s)).toEqual(["archived", "current"]);
  });

  it.each([
    ["clip_type", 5],
    ["clip_position", 3],
    ["wire_mesh", 3],
    ["wire_sides", 2],
    ["media_mats", 2],
    ["gasket", 2],
  ])("has every value of order_items.%s and NULL", async (col, values) => {
    const r = await one<{ v: number; nulls: number }>(
      `SELECT count(DISTINCT ${col})::int AS v, count(*) FILTER (WHERE ${col} IS NULL)::int AS nulls FROM order_items`,
    );
    expect(r.v).toBe(values);
    expect(r.nulls).toBeGreaterThan(0);
  });

  it("has NULL in every nullable column and both values in every boolean column", async () => {
    const cols = await q<{ table_name: string; column_name: string; is_nullable: string; data_type: string }>(
      `SELECT table_name, column_name, is_nullable, data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND is_generated = 'NEVER' AND table_name = ANY($1)`,
      [APP_TABLES],
    );
    for (const c of cols) {
      if (c.is_nullable === "YES") {
        const r = await one<{ n: number }>(`SELECT count(*)::int AS n FROM ${c.table_name} WHERE ${c.column_name} IS NULL`);
        expect(r.n, `${c.table_name}.${c.column_name} has a NULL`).toBeGreaterThan(0);
      }
      if (c.data_type === "boolean") {
        const r = await one<{ t: number; f: number }>(
          `SELECT count(*) FILTER (WHERE ${c.column_name})::int AS t, count(*) FILTER (WHERE NOT ${c.column_name})::int AS f FROM ${c.table_name}`,
        );
        expect(r.t, `${c.table_name}.${c.column_name} true`).toBeGreaterThan(0);
        expect(r.f, `${c.table_name}.${c.column_name} false`).toBeGreaterThan(0);
      }
    }
  });

  it("has types, media, products and efficiency both set and unset", async () => {
    expect((await one<{ n: number }>("SELECT count(*)::int AS n FROM product_types WHERE millimetres_per_pleat IS NOT NULL")).n).toBeGreaterThan(0);
    expect((await one<{ n: number }>("SELECT count(*)::int AS n FROM product_media WHERE pleat_spacing IS NOT NULL")).n).toBeGreaterThan(0);
    expect((await one<{ n: number }>("SELECT count(*)::int AS n FROM products WHERE efficiency IS NOT NULL")).n).toBeGreaterThan(0);
  });

  it("spreads products and order items over every category", async () => {
    const cats = (await one<{ n: number }>("SELECT count(*)::int AS n FROM product_categories")).n;
    const withProducts = await one<{ n: number }>("SELECT count(DISTINCT category_id)::int AS n FROM products");
    const withItems = await one<{ n: number }>(
      "SELECT count(DISTINCT p.category_id)::int AS n FROM order_items i JOIN products p ON p.id = i.product_id",
    );
    expect(withProducts.n).toBe(cats);
    expect(withItems.n).toBe(cats);
  });

  it("has orders due before and after the anchor date, with and without a docket", async () => {
    const r = await one<{ before: number; after: number; docket: number; nodocket: number }>(
      `SELECT count(*) FILTER (WHERE due_date < '2026-01-01')::int AS before,
              count(*) FILTER (WHERE due_date > '2026-01-01')::int AS after,
              count(*) FILTER (WHERE delivery_docket_id IS NOT NULL)::int AS docket,
              count(*) FILTER (WHERE delivery_docket_id IS NULL)::int AS nodocket
       FROM orders`,
    );
    for (const [k, v] of Object.entries(r)) expect(v, k).toBeGreaterThan(0);
  });

  it("sends dockets from the sender, holds only the docket client's orders, and has dockets with several and no orders", async () => {
    expect((await one<{ n: number }>("SELECT count(*)::int AS n FROM delivery_dockets WHERE from_client_id <> 1")).n).toBe(0);
    expect(
      (await one<{ n: number }>(
        "SELECT count(*)::int AS n FROM orders o JOIN delivery_dockets d ON d.id = o.delivery_docket_id WHERE d.to_client_id <> o.client_id",
      )).n,
    ).toBe(0);
    const per = await q<{ n: number }>(
      "SELECT count(o.id)::int AS n FROM delivery_dockets d LEFT JOIN orders o ON o.delivery_docket_id = d.id GROUP BY d.id",
    );
    expect(per.some((r) => r.n >= 2)).toBe(true);
    expect(per.some((r) => r.n === 0)).toBe(true);
  });

  it("has zero and non-zero dimensions, non-ASCII text and '/'", async () => {
    const r = await one<Record<string, number>>(
      `SELECT count(*) FILTER (WHERE height = 0 OR width = 0 OR depth = 0)::int AS zero,
              count(*) FILTER (WHERE height > 0 AND width > 0 AND depth > 0)::int AS nonzero,
              count(*) FILTER (WHERE comment ~ '[^\\x01-\\x7F]')::int AS comment_unicode,
              count(*) FILTER (WHERE comment LIKE '%/%')::int AS comment_slash,
              count(*) FILTER (WHERE part_number ~ '[^\\x01-\\x7F]')::int AS part_unicode,
              count(*) FILTER (WHERE part_number LIKE '%/%')::int AS part_slash
       FROM order_items`,
    );
    for (const [k, v] of Object.entries(r)) expect(v, k).toBeGreaterThan(0);
  });

  it("has each notcher-feed condition both met and not met", async () => {
    const r = await one<Record<string, number>>(
      `SELECT count(*) FILTER (WHERE o.status = 'new' AND NOT i.frame_status AND p.notcher)::int AS all_met,
              count(*) FILTER (WHERE o.status <> 'new' AND NOT i.frame_status AND p.notcher)::int AS not_new,
              count(*) FILTER (WHERE o.status = 'new' AND i.frame_status AND p.notcher)::int AS frame_done,
              count(*) FILTER (WHERE o.status = 'new' AND NOT i.frame_status AND NOT p.notcher)::int AS not_notcher
       FROM order_items i JOIN orders o ON o.id = i.order_id JOIN products p ON p.id = i.product_id`,
    );
    for (const [k, v] of Object.entries(r)) expect(v, k).toBeGreaterThan(0);
  });
});

describe("AC-2 identical data for the same seed", () => {
  it("gives identical rows twice with seed 1, and different rows with seed 2", async () => {
    await seed(buildDataset(1, 1));
    const first = await snapshot();
    await seed(buildDataset(1, 1));
    expect(await snapshot()).toEqual(first);
    await seed(buildDataset(2, 1));
    expect(await snapshot()).not.toEqual(first);
  });
});

describe("AC-3 wipe and replace, users kept", () => {
  it("removes earlier app data and keeps users and login_attempts", async () => {
    await seed(buildDataset(1, 1));
    await q("INSERT INTO clients (name) VALUES ('Old Client Before Seed')");
    await q("INSERT INTO users (email, password_hash) VALUES ('kept@example.com', 'hash')");
    await q("INSERT INTO login_attempts (ip) VALUES ('203.0.113.9')");
    const usersBefore = await q("SELECT * FROM users ORDER BY id");
    const attemptsBefore = await q("SELECT * FROM login_attempts ORDER BY id");

    await seed(buildDataset(1, 1));

    expect(await q("SELECT id FROM clients WHERE name = 'Old Client Before Seed'")).toHaveLength(0);
    expect(await q("SELECT * FROM users ORDER BY id")).toEqual(usersBefore);
    expect(await q("SELECT * FROM login_attempts ORDER BY id")).toEqual(attemptsBefore);
  });
});

describe("AC-4 sequences", () => {
  it("never lowers the order and order-item sequences, and restarts the reference and docket ids", async () => {
    await q("ALTER TABLE orders ALTER COLUMN id RESTART WITH 100000");
    await q("ALTER TABLE order_items ALTER COLUMN id RESTART WITH 100000");
    await seed(buildDataset(1, 1));

    expect((await one<{ m: string }>("SELECT min(id)::text AS m FROM orders")).m).not.toBeNull();
    expect(Number((await one<{ m: string }>("SELECT min(id)::text AS m FROM orders")).m)).toBeGreaterThanOrEqual(100000);
    expect(Number((await one<{ m: string }>("SELECT min(id)::text AS m FROM order_items")).m)).toBeGreaterThanOrEqual(100000);
    const maxOrder = Number((await one<{ m: string }>("SELECT max(id)::text AS m FROM orders")).m);

    for (const t of ["clients", "product_categories", "product_types", "product_sizes", "product_media", "products", "delivery_dockets"]) {
      expect(Number((await one<{ m: string }>(`SELECT min(id)::text AS m FROM ${t}`)).m), t).toBe(1);
    }

    // Seeding again keeps counting up.
    await seed(buildDataset(1, 1));
    expect(Number((await one<{ m: string }>("SELECT min(id)::text AS m FROM orders")).m)).toBeGreaterThan(maxOrder);
  });

  it("puts the sender at FROM_CLIENT_ID 20 without clashing, and moves the clients sequence past the highest id", async () => {
    await seed(buildDataset(1, 20));
    expect(await one("SELECT name FROM clients WHERE id = 20")).toEqual({ name: "Fibatron (dummy)" });
    const ids = (await q<{ id: string }>("SELECT id::text AS id FROM clients")).map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    const max = Math.max(...ids.map(Number));
    const next = await one<{ id: string }>("INSERT INTO clients (name) VALUES ('Next') RETURNING id::text AS id");
    expect(Number(next.id)).toBeGreaterThan(max);
  });
});

describe("review nits b and c", () => {
  it("sets an empty table's sequence so its next id is 1", async () => {
    const ds = buildDataset(1, 1);
    for (const o of ds.orders) o.delivery_docket_id = null;
    ds.delivery_dockets = [];
    await seed(ds);
    const next = await one<{ id: string }>(
      "INSERT INTO delivery_dockets (from_client_id, to_client_id, date) VALUES (1, 1, '2026-01-01') RETURNING id::text AS id",
    );
    expect(next.id).toBe("1");
  });

  it("inserts more order items than one chunk holds", async () => {
    const ds = buildDataset(1, 1);
    ds.order_items = [...ds.order_items, ...ds.order_items, ...ds.order_items, ...ds.order_items];
    await seed(ds);
    expect((await one<{ n: number }>("SELECT count(*)::int AS n FROM order_items")).n).toBe(1440);
  });
});

describe("AC-5 rollback on failure", () => {
  it("leaves every table as it was when an insert fails", async () => {
    await seed(buildDataset(1, 1));
    const before = await snapshot();
    const bad = buildDataset(3, 1);
    bad.order_items[0] = { ...bad.order_items[0], product_id: 999999 };
    await expect(seed(bad)).rejects.toThrow();
    expect(await snapshot()).toEqual(before);
  });
});
