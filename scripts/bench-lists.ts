// Spec 09 P1 / AC-14: times the Order Items list query against a throwaway database holding
// 100,000 order items on 45,000 orders, and fails if either median is over 300 ms.
//
// Local only: no workflow runs it (tests/unit/seed-dummy-dataset.test.ts). It creates its
// own database on the server in DATABASE_URL_UNPOOLED, points DATABASE_URL at it before
// lib/db is loaded, and drops it in `finally`, so it never touches .env's database.
//
// Sizing: v1 production (checked 2026-11-02) holds 28,484 order items and 13,275 orders,
// growing ~9,500 items a year at ~2.1 items per order. 100k items is about 3.5× today.
import { performance } from "node:perf_hooks";
import { createThrowawayDb, withUrl } from "../tests/helpers/throwaway-db";

const ORDERS = 45_000;
const ITEMS = 100_000;
const RUNS = 5;
const LIMIT_MS = 300;

try {
  process.loadEnvFile(".env");
} catch {
  // no .env file: the variables come from the environment
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function seed(url: string): Promise<void> {
  const sender = Number(process.env.FROM_CLIENT_ID ?? 1);
  await withUrl(url, async (c) => {
    await c.query(
      "INSERT INTO clients (id, name, address_shipping) OVERRIDING SYSTEM VALUE VALUES ($1, 'Bench sender', '1 Factory Road')",
      [sender],
    );
    await c.query("SELECT setval(pg_get_serial_sequence('clients', 'id'), $1)", [sender]);
    await c.query("INSERT INTO clients (name) SELECT 'Bench client ' || g FROM generate_series(1, 30) g");
    await c.query("INSERT INTO product_categories (name) SELECT 'Bench category ' || g FROM generate_series(1, 4) g");
    await c.query("INSERT INTO product_types (name, code) SELECT 'Bench type ' || g, 'BT' || g FROM generate_series(1, 10) g");
    await c.query("INSERT INTO product_sizes (name) SELECT 'Bench size ' || g FROM generate_series(1, 10) g");
    await c.query("INSERT INTO product_media (name, code) SELECT 'Bench media ' || g, 'BM' || g FROM generate_series(1, 5) g");
    await c.query(`
      INSERT INTO products (name, category_id, type_id, size_id, media_id)
      SELECT 'Bench product ' || g,
        (SELECT id FROM product_categories ORDER BY id OFFSET (g % 4) LIMIT 1),
        (SELECT id FROM product_types ORDER BY id OFFSET (g % 10) LIMIT 1),
        (SELECT id FROM product_sizes ORDER BY id OFFSET (g % 10) LIMIT 1),
        (SELECT id FROM product_media ORDER BY id OFFSET (g % 5) LIMIT 1)
      FROM generate_series(1, 60) g`);
    // Orders: statuses spread evenly, dates over about four years.
    await c.query(
      `INSERT INTO orders (client_id, order_number, due_date, date, status)
       SELECT (SELECT array_agg(id ORDER BY id) FROM clients WHERE id <> $1)[1 + g % 30],
         'BENCH-' || g, DATE '2023-01-01' + (g % 1460), DATE '2023-01-01' + (g % 1460) - 14,
         (ARRAY['new', 'complete', 'archived'])[1 + g % 3]::order_status
       FROM generate_series(1, $2) g`,
      [sender, ORDERS],
    );
    // Items: 3 on the first orders and 2 on the rest, ITEMS in all (~2.2 per order).
    const three = ITEMS - 2 * ORDERS;
    await c.query(
      `WITH o AS (SELECT id, row_number() OVER (ORDER BY id) AS n FROM orders),
            p AS (SELECT array_agg(id ORDER BY id) AS ids FROM products)
       INSERT INTO order_items (order_id, product_id, part_number, quantity, height, width, depth)
       SELECT o.id, p.ids[1 + (o.id + k) % 60], 'PN-' || o.id || '-' || k, 1 + k, 400, 500, 48
       FROM o, p, generate_series(1, 3) k
       WHERE k <= CASE WHEN o.n <= $1 THEN 3 ELSE 2 END`,
      [three],
    );
    await c.query("ANALYZE");
  });
}

async function main(): Promise<void> {
  const db = await createThrowawayDb();
  try {
    console.log("Seeding 45,000 orders and 100,000 order items…");
    await seed(db.url);
    // Point the app's driver at the throwaway database before it is loaded.
    process.env.DATABASE_URL = db.url;
    const { listRecords } = await import("../lib/db/list-query");

    const results: [string, number][] = [];
    for (const [tab, status] of [["All", undefined], ["New", "new"]] as const) {
      await listRecords("order_items", { status, page: 1, pageSize: 25 }); // warm-up
      const times: number[] = [];
      for (let i = 0; i < RUNS; i++) {
        const t = performance.now();
        const r = await listRecords("order_items", { status, page: 1, pageSize: 25 });
        times.push(performance.now() - t);
        if (r.rows.length !== 25) throw new Error(`${tab}: expected 25 rows, got ${r.rows.length}`);
      }
      results.push([tab, median(times)]);
    }
    for (const [tab, ms] of results) console.log(`${tab.padEnd(4)} median ${ms.toFixed(0)} ms (limit ${LIMIT_MS} ms)`);
    process.exitCode = results.some(([, ms]) => ms > LIMIT_MS) ? 1 : 0;
  } finally {
    // Close the app's local pool (lib/db keeps it on globalThis) before the forced drop ends its connections.
    const pool = (globalThis as { __fibDevPool?: Promise<{ end: () => Promise<void> }> }).__fibDevPool;
    if (pool) await (await pool).end();
    await db.drop();
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => setTimeout(() => process.exit(process.exitCode ?? 0), 100));
