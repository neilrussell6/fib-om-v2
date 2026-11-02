import { z } from "zod";
import { ORDER_STATUS } from "@/lib/resources";
import { buildSchema } from "@/lib/resources/schema";

/** The fields that belong to the order, not the item (spec 06): never sent to updateRecord. */
export const ORDER_FIELDS = ["order_due_date", "order_status"] as const;

/**
 * The item form's schema plus the order's due date and status, shared by the panel and its
 * Server Action. The order fields are optional (spec 07 fix 1): the panel sends them only when
 * the user changed them. A value that is sent is validated as before.
 */
export function panelSchema() {
  const statuses = ORDER_STATUS.map((o) => o.value) as [string, ...string[]];
  return buildSchema("order_items", "edit").extend({
    order_due_date: z.preprocess(
      (v) => (v === undefined ? undefined : typeof v === "string" && v.trim() ? v.trim() : null),
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "please provide a valid date").nullable().refine((v) => v !== null, "Required").optional(),
    ),
    order_status: z.enum(statuses, { error: "please choose one of the options" }).optional(),
  });
}
