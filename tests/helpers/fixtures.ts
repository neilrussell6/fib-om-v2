// Test-only data helper: inserts minimal rows straight into the test database
// (direct connection, not the app's driver) and removes them again.
import type pg from "pg";
import { withDb } from "./test-db";

export const SENDER_CLIENT_ID = Number(process.env.FROM_CLIENT_ID ?? 1);

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

async function insert(c: pg.Client, table: string, values: Record<string, unknown>): Promise<number> {
  const cols = Object.keys(values);
  const params = cols.map((_, i) => `$${i + 1}`);
  const r = await c.query(
    `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${params.join(", ")}) RETURNING id`,
    Object.values(values),
  );
  return Number(r.rows[0].id);
}

export type Fixture = {
  tag: string;
  clientId: number;
  otherClientId: number;
  categoryId: number;
  typeId: number;
  sizeId: number;
  mediaId: number;
  productId: number;
  docketId: number;
  otherDocketId: number;
  orderId: number;
  orderItemId: number;
  names: {
    client: string;
    otherClient: string;
    category: string;
    type: string;
    typeCode: string;
    size: string;
    media: string;
    mediaCode: string;
    product: string;
    orderNumber: string;
    partNumber: string;
  };
};

/** One of everything, linked together, with unique names tagged for cleanup. */
export async function createFixture(): Promise<Fixture> {
  const tag = `fx${uid()}`;
  const names = {
    client: `${tag} Client`,
    otherClient: `${tag} Other Client`,
    category: `${tag} Category`,
    type: `${tag} Type`,
    typeCode: `${tag.toUpperCase()}T`,
    size: `${tag} Size`,
    media: `${tag} Media`,
    mediaCode: `${tag.toUpperCase()}M`,
    product: `${tag} Product`,
    orderNumber: `${tag}-ORD`,
    partNumber: `${tag}-PN`,
  };
  return withDb(async (c) => {
    await ensureSenderClient(c);
    const clientId = await insert(c, "clients", { name: names.client, address_shipping: `${tag} Street` });
    const otherClientId = await insert(c, "clients", { name: names.otherClient });
    const categoryId = await insert(c, "product_categories", { name: names.category });
    const typeId = await insert(c, "product_types", { name: names.type, code: names.typeCode, millimetres_per_pleat: 10 });
    const sizeId = await insert(c, "product_sizes", { name: names.size });
    const mediaId = await insert(c, "product_media", { name: names.media, code: names.mediaCode, pleat_spacing: 5 });
    const productId = await insert(c, "products", {
      name: names.product,
      category_id: categoryId,
      type_id: typeId,
      size_id: sizeId,
      media_id: mediaId,
    });
    const docketId = await insert(c, "delivery_dockets", { from_client_id: SENDER_CLIENT_ID, to_client_id: clientId });
    const otherDocketId = await insert(c, "delivery_dockets", { from_client_id: SENDER_CLIENT_ID, to_client_id: otherClientId });
    const orderId = await insert(c, "orders", { client_id: clientId, order_number: names.orderNumber, due_date: "2026-12-01" });
    const orderItemId = await insert(c, "order_items", {
      order_id: orderId,
      product_id: productId,
      part_number: names.partNumber,
      quantity: 2,
      height: 500,
      width: 600,
      depth: 50,
    });
    return { tag, clientId, otherClientId, categoryId, typeId, sizeId, mediaId, productId, docketId, otherDocketId, orderId, orderItemId, names };
  });
}

/** Removes every row whose identifying text contains the fixture tag (including rows tests created). */
export async function removeFixture(tag: string): Promise<void> {
  const like = `%${tag}%`;
  await withDb(async (c) => {
    await c.query(
      `DELETE FROM order_items WHERE part_number ILIKE $1 OR order_id IN (SELECT id FROM orders WHERE order_number ILIKE $1)
         OR product_id IN (SELECT id FROM products WHERE name ILIKE $1)`,
      [like],
    );
    await c.query(
      `DELETE FROM orders WHERE order_number ILIKE $1 OR client_id IN (SELECT id FROM clients WHERE name ILIKE $1)`,
      [like],
    );
    await c.query(
      `DELETE FROM delivery_dockets WHERE to_client_id IN (SELECT id FROM clients WHERE name ILIKE $1)`,
      [like],
    );
    await c.query(
      `DELETE FROM products WHERE name ILIKE $1 OR category_id IN (SELECT id FROM product_categories WHERE name ILIKE $1)
         OR type_id IN (SELECT id FROM product_types WHERE name ILIKE $1)`,
      [like],
    );
    for (const t of ["product_categories", "product_types", "product_sizes", "product_media"]) {
      await c.query(`DELETE FROM ${t} WHERE name ILIKE $1`, [like]);
    }
    await c.query(`DELETE FROM clients WHERE name ILIKE $1 AND id <> $2`, [like, SENDER_CLIENT_ID]);
    await c.query(`DELETE FROM users WHERE email ILIKE $1`, [like]);
  });
}

/** The sender client (Fibatron's own row) must exist with the fixed id from FROM_CLIENT_ID. */
export async function ensureSenderClient(c?: pg.Client): Promise<void> {
  const run = async (client: pg.Client) => {
    await client.query(
      `INSERT INTO clients (id, name, address_shipping) OVERRIDING SYSTEM VALUE
       VALUES ($1, 'Fibatron (sender)', '1 Factory Road') ON CONFLICT (id) DO NOTHING`,
      [SENDER_CLIENT_ID],
    );
    await client.query(
      `SELECT setval(pg_get_serial_sequence('clients', 'id'), GREATEST((SELECT max(id) FROM clients), 1))`,
    );
  };
  if (c) await run(c);
  else await withDb(run);
}

export { uid };
