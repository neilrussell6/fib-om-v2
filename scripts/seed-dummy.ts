/**
 * Fills a local or staging database with a deterministic synthetic dataset (spec 03).
 * Wipes every app table except users and login_attempts. Never production, never CI.
 *
 *   npm run seed:dummy -- --target local [--seed <n>]
 *   npm run seed:dummy -- --target staging [--seed <n>] [--yes]
 *
 * Settings come from the target's env file (variables already set in the shell win):
 * --target local reads .env and only accepts a local database host.
 * --target staging reads .env.staging: DATABASE_URL_UNPOOLED (the staging branch),
 * PRODUCTION_DB_HOST and FROM_CLIENT_ID (Vercel Preview's value); it then asks you to
 * type "staging" unless --yes is given.
 */
import { parseArgs } from "node:util";
import pg from "pg";
import { SHOW_COLUMNS, V1_CATEGORIES, flagsWith } from "@/lib/data/v1-categories";
import { confirmTarget, exitWithError, type PreflightEnv, UsageError } from "./lib/cli";
import { checkTarget, envValue, GuardError, isProductionHost, loadTargetEnv, parseTarget } from "./lib/target-guard";

export { UsageError };

export type Value = string | number | boolean | null;
export type Row = Record<string, Value>;

/**
 * Rows to insert, by table. Clients, the product catalogue and dockets carry explicit ids.
 * Orders take ids from their sequence, so order items point at an order by `order_index`
 * (its position in `orders`) instead of `order_id`.
 */
export type Dataset = {
  clients: Row[];
  product_categories: Row[];
  product_types: Row[];
  product_sizes: Row[];
  product_media: Row[];
  products: Row[];
  delivery_dockets: Row[];
  orders: Row[];
  order_items: Row[];
};

/** Every date is relative to this, never to today, so a seed always gives the same rows. */
export const ANCHOR_DATE = "2026-01-01";
export const SENDER_NAME = "Fibatron (dummy)";

const COUNTS = { dummyClients: 36, types: 8, sizes: 8, media: 8, products: 72, dockets: 24, orders: 72, itemsPerOrder: 5 };

// ---- seeded PRNG (mulberry32) ----------------------------------------------------------

type Rng = {
  next: () => number;
  int: (min: number, max: number) => number;
  pick: <T>(list: readonly T[]) => T;
  chance: (p: number) => boolean;
};

function rng(seed: number): Rng {
  let a = (seed >>> 0) ^ 0x9e3779b9;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  return { next, int, pick: (list) => list[int(0, list.length - 1)], chance: (p) => next() < p };
}

const pad = (n: number, w: number) => String(n).padStart(w, "0");

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Cycles through every value and then NULL, so each enum value and NULL appear. */
const cycle = <T>(values: readonly T[], i: number): T | null => (i % (values.length + 1) === values.length ? null : values[i % (values.length + 1)]);

// ---- dataset ---------------------------------------------------------------------------

export function buildDataset(seed: number, fromClientId: number): Dataset {
  const r = rng(seed);
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  // Clients: the sender at fromClientId, dummy clients on the other ids from 1, skipping it.
  const dummyIds: number[] = [];
  for (let id = 1; dummyIds.length < COUNTS.dummyClients; id++) if (id !== fromClientId) dummyIds.push(id);
  const phone = () => `(00) 0000 ${pad(r.int(0, 9999), 4)}`;
  const maybe = <T>(i: number, v: () => T): T | null => (i === 0 || r.chance(0.25) ? null : v());
  const clients: Row[] = [
    {
      id: fromClientId,
      name: SENDER_NAME,
      full_name: "Fibatron Dummy Pty Ltd",
      phone: null,
      landline: null,
      fax: null,
      address_shipping: "1 Dummy Factory Road, Dummyville",
      address_billing: null,
      abn: null,
      acn: null,
      label_reorder_text: null,
      label_name: null,
      label_sub_name: null,
      label_address_line1: null,
      label_address_line2: null,
      label_use_part_number: false,
    },
    ...dummyIds.map((id, i) => ({
      id,
      name: `Dummy Client ${pad(i + 1, 2)}`,
      full_name: maybe(i, () => `Dummy Client ${pad(i + 1, 2)} Pty Ltd`),
      phone: maybe(i, phone),
      landline: maybe(i, phone),
      fax: maybe(i, phone),
      address_shipping: maybe(i, () => `${r.int(1, 999)} Dummy Street, Dummyville`),
      address_billing: maybe(i, () => `PO Box ${r.int(1, 999)}, Dummy Town`),
      abn: null,
      acn: null,
      label_reorder_text: maybe(i, () => `Reorder from Dummy Client ${pad(i + 1, 2)}`),
      label_name: maybe(i, () => `DUMMY ${pad(i + 1, 2)}`),
      label_sub_name: maybe(i, () => `Dummy division ${letters[i % 26]}`),
      label_address_line1: maybe(i, () => `${r.int(1, 999)} Dummy Lane`),
      label_address_line2: maybe(i, () => "Dummyville 0000"),
      label_use_part_number: i % 2 === 1,
    })),
  ];

  // Product catalogue.
  const product_categories: Row[] = [
    ...V1_CATEGORIES.map((c) => ({ name: c.name, ...c.flags })),
    { name: "Dummy All Columns", ...flagsWith(SHOW_COLUMNS) },
    { name: "Dummy No Columns", ...flagsWith([]) },
  ].map((row, i) => ({ id: i + 1, ...row }));

  const product_types: Row[] = Array.from({ length: COUNTS.types }, (_, i) => ({
    id: i + 1,
    name: `Dummy Type ${letters[i]}`,
    code: `DT${letters[i]}`,
    millimetres_per_pleat: i === 0 ? null : r.int(5, 25),
  }));
  const product_sizes: Row[] = Array.from({ length: COUNTS.sizes }, (_, i) => ({
    id: i + 1,
    name: `Dummy Size ${r.int(3, 12) * 100}x${r.int(3, 12) * 100}`,
  }));
  const product_media: Row[] = Array.from({ length: COUNTS.media }, (_, i) => ({
    id: i + 1,
    name: `Dummy Media ${i + 1}`,
    code: `DM${i + 1}`,
    pleat_spacing: i === 0 ? null : r.int(2, 12),
  }));
  const products: Row[] = Array.from({ length: COUNTS.products }, (_, i) => ({
    id: i + 1,
    name: `Dummy Product ${pad(i + 1, 3)}`,
    category_id: (i % product_categories.length) + 1,
    type_id: r.int(1, COUNTS.types),
    size_id: r.int(1, COUNTS.sizes),
    media_id: r.int(1, COUNTS.media),
    notcher: i % 3 !== 2,
    efficiency: i % 4 === 0 ? null : `F${r.int(5, 9)}`,
  }));

  // Orders: every dummy client gets orders (client k has orders k, k + 36, …).
  const orderStatuses = ["new", "new", "complete", "archived"] as const;
  const orders: Row[] = Array.from({ length: COUNTS.orders }, (_, i) => {
    const before = i % 2 === 0;
    return {
      client_id: dummyIds[i % dummyIds.length],
      order_number: `DMY-${pad(r.int(0, 9999), 4)}`,
      date: addDays(ANCHOR_DATE, -r.int(30, 120)),
      due_date: addDays(ANCHOR_DATE, before ? -r.int(1, 25) : r.int(1, 60)),
      status: orderStatuses[i % orderStatuses.length],
      delivery_docket_id: null,
    };
  });

  // Dockets: docket d goes to dummy client d, so it can hold that client's orders.
  // d % 3 = 0: no orders; 1: all of the client's orders; 2: one order.
  const delivery_dockets: Row[] = Array.from({ length: COUNTS.dockets }, (_, d) => ({
    id: d + 1,
    from_client_id: fromClientId,
    to_client_id: dummyIds[d],
    date: addDays(ANCHOR_DATE, -r.int(0, 90)),
    status: d % 4 === 3 ? "archived" : "current",
  }));
  delivery_dockets.forEach((docket, d) => {
    if (d % 3 === 0) return;
    const own = orders.filter((o) => o.client_id === docket.to_client_id);
    for (const o of d % 3 === 1 ? own : own.slice(0, 1)) o.delivery_docket_id = docket.id;
  });

  // Order items.
  const yesNo = ["1", "2"] as const;
  const items: Row[] = Array.from({ length: COUNTS.orders * COUNTS.itemsPerOrder }, (_, j) => {
    const nullable = (v: () => Value) => (j % 5 === 0 ? null : v());
    return {
      order_index: j % COUNTS.orders,
      product_id: (j % COUNTS.products) + 1,
      part_number: `PN-${pad(r.int(0, 99999), 5)}`,
      quantity: r.int(1, 50),
      height: r.int(100, 1200),
      width: r.int(100, 1200),
      depth: r.int(20, 600),
      comment: j % 4 === 0 ? null : `Dummy comment ${j + 1}`,
      has_wire_header: r.chance(0.5),
      has_header_frame: r.chance(0.5),
      type: nullable(() => `Dummy ${letters[r.int(0, 5)]}`),
      number: nullable(() => r.int(1, 20)),
      clip_type: cycle(["pocket", "bag", "hepa", "gate", "ring"], j),
      clip_position: cycle(["bevel", "ludwig", "clamp"], j),
      has_gasket: r.chance(0.5),
      pockets: nullable(() => r.int(1, 12)),
      has_legs: r.chance(0.5),
      wire_mesh: cycle(["0", "1", "2"], j),
      has_gate: r.chance(0.5),
      wire_sides: cycle(yesNo, j),
      media_mats: cycle(yesNo, j + 1),
      gasket: cycle(yesNo, j + 2),
      drawing_number: nullable(() => r.int(1000, 9999)),
      cut_count: nullable(() => r.int(0, 100)),
      sow_count: nullable(() => r.int(0, 100)),
      cut_status: r.chance(0.5),
      sow_status: r.chance(0.5),
      frame_status: r.chance(0.5),
      media_status: r.chance(0.5),
      wire_status: r.chance(0.5),
      package_status: r.chance(0.5),
      assemble_status: r.chance(0.5),
    };
  });

  // Guaranteed edge cases, whatever the seed.
  const booleans = Object.keys(items[0]).filter((k) => typeof items[0][k] === "boolean");
  for (const k of booleans) {
    items[7][k] = true;
    items[8][k] = false;
  }
  items[5].part_number = "PN/Ü-00005";
  items[5].comment = "Ölfilter / spezial – dummy";
  items[6].height = 0;
  items[6].width = 0;

  // The notcher feed's conditions (order new, frame not done, product notcher), each met
  // and not met on its own.
  const newOrder = orders.findIndex((o) => o.status === "new");
  const oldOrder = orders.findIndex((o) => o.status !== "new");
  const notcherProduct = products.findIndex((p) => p.notcher) + 1;
  const plainProduct = products.findIndex((p) => !p.notcher) + 1;
  const feed = [
    { order_index: newOrder, product_id: notcherProduct, frame_status: false },
    { order_index: oldOrder, product_id: notcherProduct, frame_status: false },
    { order_index: newOrder, product_id: notcherProduct, frame_status: true },
    { order_index: newOrder, product_id: plainProduct, frame_status: false },
  ];
  feed.forEach((f, k) => Object.assign(items[k], f));

  return { clients, product_categories, product_types, product_sizes, product_media, products, delivery_dockets, orders, order_items: items };
}

// ---- writing ---------------------------------------------------------------------------

/** Tables seed-dummy empties; users, login_attempts and the Atlas revisions table are kept. */
const WIPED = [
  "order_items",
  "orders",
  "delivery_dockets",
  "products",
  "product_media",
  "product_sizes",
  "product_types",
  "product_categories",
  "clients",
] as const;
/** Tables inserted with explicit ids, in FK order; each sequence is then set past the highest id. */
const EXPLICIT_IDS = ["clients", "product_categories", "product_types", "product_sizes", "product_media", "products", "delivery_dockets"] as const;

/** Rows per INSERT, so a statement stays well under Postgres's 65,535-parameter limit. */
const CHUNK = 500;

async function insertRows(c: pg.Client, table: string, rows: Row[], overriding: boolean): Promise<void> {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  for (let start = 0; start < rows.length; start += CHUNK) {
    const params: Value[] = [];
    const values = rows.slice(start, start + CHUNK).map((row) => {
      const placeholders = cols.map((col) => {
        params.push(row[col]);
        return `$${params.length}`;
      });
      return `(${placeholders.join(", ")})`;
    });
    await c.query(
      `INSERT INTO ${table} (${cols.join(", ")}) ${overriding ? "OVERRIDING SYSTEM VALUE " : ""}VALUES ${values.join(", ")}`,
      params,
    );
  }
}

/** Wipes and replaces all app data in one transaction; returns rows inserted per table. */
export async function seedDummy(c: pg.Client, dataset: Dataset): Promise<Record<string, number>> {
  await c.query("BEGIN");
  try {
    // One statement: Postgres won't truncate a table referenced by one left out.
    await c.query(`TRUNCATE ${WIPED.join(", ")} CONTINUE IDENTITY`);

    // Explicit ids from 1; the next generated id is one past the highest (1 for an empty table).
    for (const t of EXPLICIT_IDS) {
      await insertRows(c, t, dataset[t], true);
      await c.query(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), (SELECT coalesce(max(id), 0) + 1 FROM ${t}), false)`);
    }

    // Orders take ids from their sequence, one at a time so each id maps to its position.
    const orderIds: string[] = [];
    for (const o of dataset.orders) {
      const cols = Object.keys(o);
      const res = await c.query(
        `INSERT INTO orders (${cols.join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING id`,
        cols.map((k) => o[k]),
      );
      orderIds.push(res.rows[0].id);
    }
    const items = dataset.order_items.map(({ order_index, ...rest }) => {
      const order_id = orderIds[Number(order_index)];
      if (order_id === undefined) throw new Error(`order item refers to missing order ${order_index}`);
      return { order_id, ...rest };
    });
    await insertRows(c, "order_items", items, false);

    await c.query("COMMIT");
  } catch (err) {
    // A failed ROLLBACK (e.g. a dropped connection) must not hide the original error.
    await c.query("ROLLBACK").catch(() => {});
    throw err;
  }
  return Object.fromEntries(Object.entries(dataset).map(([t, rows]) => [t, rows.length]));
}

// ---- CLI -------------------------------------------------------------------------------

type Args = { target: string | undefined; seed: number; yes: boolean };

/** Strict: unknown options, positionals and missing values are errors; `--opt=value` works. */
export function parseCliArgs(argv: readonly string[]): Args {
  let values: { target?: string; seed?: string; yes?: boolean };
  try {
    ({ values } = parseArgs({
      args: [...argv],
      options: { target: { type: "string" }, seed: { type: "string" }, yes: { type: "boolean" } },
      strict: true,
      allowPositionals: false,
    }));
  } catch (err) {
    throw new UsageError(`${(err as Error).message} (usage: --target <local|staging> [--seed <n>] [--yes])`);
  }
  let seed = 1;
  if (values.seed !== undefined) {
    seed = Number(values.seed);
    if (values.seed.trim() === "" || !Number.isInteger(seed)) throw new UsageError(`--seed must be an integer, got "${values.seed}"`);
  }
  return { target: values.target, seed, yes: values.yes ?? false };
}

function positiveInt(name: string, value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new UsageError(`${name} must be a positive integer, got "${value}"`);
  return n;
}

/**
 * Every check before connecting: arguments, target (never production), the database host
 * guard, FROM_CLIENT_ID and, for staging, the typed confirmation. Throws a one-line
 * UsageError or GuardError on refusal (spec 03 AC-6, AC-7; unit tested since spec 09).
 */
export async function seedPreflight(
  argv: readonly string[],
  { env = process.env, dir = process.cwd(), isTTY = Boolean(process.stdin.isTTY) }: PreflightEnv = {},
): Promise<{ target: "local" | "staging"; host: string; seed: number; fromClientId: number }> {
  const args = parseCliArgs(argv);
  const target = parseTarget(args.target);
  if (target === "production") throw new GuardError("seed-dummy never runs against production");
  const envFile = loadTargetEnv(target, dir, env);
  const host = checkTarget(target, env);
  if (isProductionHost(env)) throw new GuardError("DATABASE_URL_UNPOOLED points at the production database");

  let fromClientId = 1;
  const fromEnv = envValue("FROM_CLIENT_ID", env);
  if (target === "staging") {
    if (!fromEnv) throw new GuardError("FROM_CLIENT_ID must be set for --target staging (use Vercel Preview's value)");
    fromClientId = positiveInt("FROM_CLIENT_ID", fromEnv);
    console.log(`Target staging: ${host} (settings from ${envFile ?? "the shell environment"})`);
    await confirmTarget(target, args.yes, "This wipes staging's clients, products, orders and dockets.", isTTY);
  } else if (fromEnv) {
    fromClientId = positiveInt("FROM_CLIENT_ID", fromEnv);
  }
  return { target, host, seed: args.seed, fromClientId };
}

async function main(argv: readonly string[]): Promise<void> {
  const { target, seed, fromClientId } = await seedPreflight(argv);
  const client = new pg.Client({ connectionString: envValue("DATABASE_URL_UNPOOLED") });
  await client.connect();
  try {
    const counts = await seedDummy(client, buildDataset(seed, fromClientId));
    console.log(`Seeded ${target} with seed ${seed} (sender client ${fromClientId}):`);
    for (const [t, n] of Object.entries(counts)) console.log(`  ${t.padEnd(20)} ${n}`);
  } finally {
    await client.end();
  }
}

if (process.argv[1] && /seed-dummy\.ts$/.test(process.argv[1])) {
  main(process.argv.slice(2)).then(() => process.exit(0), exitWithError);
}
