"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { query, tx } from "@/lib/db";
import { mapDbError } from "@/lib/db/errors";
import { updateRecord } from "@/lib/db/records";
import type { SaveResult } from "@/lib/resources/actions";
import { ORDER_FIELDS, panelSchema } from "./panel-schema";
import { isId, STAGE_FLAG_SELECT, type StageFlags, takeStageFlags } from "./stages";

/**
 * The edit panel's Server Actions (spec 06). Every export here is a public
 * endpoint, so each one checks the session first.
 */

export type ProductPanelInfo = { product_size_name: string; stageFlags: StageFlags };
export type OrderPanelInfo = {
  order_number: string;
  order_date: string;
  order_due_date: string;
  order_status: string;
  order_item_count: number;
  client_id: string;
  client_name: string;
};

/** Size and category stage flags for a product, when Product changes in the panel. */
export async function getProductPanelInfo(productId: string | number): Promise<ProductPanelInfo | null> {
  await requireSession();
  if (!isId(productId)) return null;
  const rows = await query(
    `SELECT ps.name AS product_size_name, ${STAGE_FLAG_SELECT("pc")}
       FROM products p
       JOIN product_sizes ps ON ps.id = p.size_id
       JOIN product_categories pc ON pc.id = p.category_id
      WHERE p.id = $1`,
    [String(productId)],
  );
  const row = rows[0];
  if (!row) return null;
  const stageFlags = takeStageFlags(row);
  return { product_size_name: String(row.product_size_name), stageFlags };
}

/** The order's dates, status, item count and client, when Order changes in the panel. */
export async function getOrderPanelInfo(orderId: string | number): Promise<OrderPanelInfo | null> {
  await requireSession();
  if (!isId(orderId)) return null;
  const rows = await query<OrderPanelInfo>(
    `SELECT o.order_number, o.date AS order_date, o.due_date AS order_due_date, o.status::text AS order_status,
            (SELECT count(*)::int FROM order_items x WHERE x.order_id = o.id) AS order_item_count,
            o.client_id, c.name AS client_name
       FROM orders o
       JOIN clients c ON c.id = o.client_id
      WHERE o.id = $1`,
    [String(orderId)],
  );
  return rows[0] ?? null;
}

export type PanelSaveResult = SaveResult & { orderStatus?: string };

/**
 * Saves the panel (spec 06, Design → Save): the item through the allowlisted
 * writer, then — if they changed — the due date and status of the order the item
 * now belongs to, all in one transaction. The order fields are only sent when the
 * user changed them (spec 07 fix 1); without them the order is left untouched.
 */
export async function saveOrderItemPanel(id: string | number, input: Record<string, unknown>): Promise<PanelSaveResult> {
  await requireSession();
  if (!isId(id)) return { ok: false, error: "Order Item not found" };

  const parsed = panelSchema().safeParse(input ?? {});
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, fieldErrors };
  }

  // Order fields never reach updateRecord; only the item's own fields do.
  const data = { ...(parsed.data as Record<string, unknown>) };
  const order =
    data.order_due_date !== undefined && data.order_status !== undefined
      ? { due_date: data.order_due_date as string, status: data.order_status as string }
      : null;
  for (const k of ORDER_FIELDS) delete data[k];

  let orderStatus: string;
  try {
    const result = await tx(async (client) => {
      if (!(await updateRecord("order_items", String(id), data, client))) return null;
      // The order the item belongs to after the update, read back from the item row.
      const { rows } = await client.query(
        `SELECT o.id, o.due_date::text AS due_date, o.status::text AS status
           FROM order_items i JOIN orders o ON o.id = i.order_id
          WHERE i.id = $1 FOR UPDATE OF o`,
        [String(id)],
      );
      const current = rows[0] as { id: string; due_date: string; status: string };
      if (!order) return current.status; // fix 1: the order wasn't changed in the panel
      if (current.due_date !== order.due_date || current.status !== order.status) {
        await client.query("UPDATE orders SET due_date = $1, status = $2::order_status WHERE id = $3", [order.due_date, order.status, current.id]);
      }
      return order.status;
    });
    if (result === null) return { ok: false, error: "Order Item not found" };
    orderStatus = result;
  } catch (err) {
    const e = err as { code?: string; constraint?: string };
    if (e.code === "23503" && e.constraint?.includes("order_id")) return { ok: false, fieldErrors: { order_id: "please choose an existing order" } };
    if (e.code === "23503" && e.constraint?.includes("product_id")) return { ok: false, fieldErrors: { product_id: "please choose an existing product" } };
    return { ok: false, error: mapDbError(err, "save") };
  }

  revalidatePath("/order-items");
  return { ok: true, id: Number(id), redirectTo: "/order-items", message: "Order Item successfully updated", orderStatus };
}
