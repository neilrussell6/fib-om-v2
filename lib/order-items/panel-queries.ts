import "server-only";
import { query } from "@/lib/db";
import { APP_TIME_ZONE } from "@/lib/time";
import { isId, STAGE_FLAG_SELECT, type StageFlags, takeStageFlags } from "./stages";

/**
 * The edit panel's data for one order item (spec 06), read only by the
 * Order Items page (behind requireSession). Deliberately not a Server Actions
 * module: nothing here is callable from the browser (task review B1).
 *
 * line_number and order_item_count are correlated counts for this one item,
 * never window functions in order_items_v (spec review B1).
 */
export type OrderItemPanelData = Record<string, unknown> & {
  id: string;
  order_id: string;
  line_number: number;
  order_item_count: number;
  stageFlags: StageFlags;
};

export async function getOrderItemPanel(id: unknown): Promise<OrderItemPanelData | null> {
  if (!isId(id)) return null;
  const rows = await query(
    `SELECT v.*,
            v.order_due_date - (now() AT TIME ZONE '${APP_TIME_ZONE}')::date AS due_in_days,
            (SELECT count(*)::int FROM order_items x WHERE x.order_id = v.order_id AND x.id <= v.id) AS line_number,
            (SELECT count(*)::int FROM order_items x WHERE x.order_id = v.order_id) AS order_item_count,
            ${STAGE_FLAG_SELECT("pc")}
       FROM order_items_v v
       JOIN product_categories pc ON pc.id = v.product_category_id
      WHERE v.id = $1`,
    [String(id)],
  );
  const row = rows[0];
  if (!row) return null;
  const stageFlags = takeStageFlags(row);
  return { ...row, stageFlags } as OrderItemPanelData;
}
