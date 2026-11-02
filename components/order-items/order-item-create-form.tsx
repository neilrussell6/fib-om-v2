"use client";

import { useEffect, useState } from "react";
import { Controller, useWatch } from "react-hook-form";
import { CreateDialog } from "@/components/resource/create/create-dialog";
import { CreateField, CreateSections, useCreateForm } from "@/components/resource/create/record-create-form";
import { QuantityStepper } from "@/components/resource/quantity-stepper";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getProductPanelInfo } from "@/lib/order-items/panel-actions";
import { cn } from "@/lib/utils";

/** The ungrouped fields in the dialog's order: Order, Product, then Size beside Quantity (spec 08). */
const LEAD = ["order_id", "product_id"];
const AFTER = ["part_number", "height", "width", "depth", "comment"];

/**
 * The Order Items create dialog (spec 08): the item create form, plus a read-only Size
 * that follows the chosen product and a Quantity stepper. Create another keeps the Order
 * and moves focus to Product.
 */
export function OrderItemCreateForm({ baseQuery }: { baseQuery: string }) {
  const cf = useCreateForm({
    resourceKey: "order_items",
    baseQuery,
    keep: ["order_id"],
    focusOrder: [...LEAD, "quantity", ...AFTER],
  });
  const { control, formState } = cf.form;
  const productId = useWatch({ control, name: "product_id" }) as string | undefined;
  const [size, setSize] = useState<{ product: string; name: string } | null>(null);

  useEffect(() => {
    if (!productId) return;
    let live = true;
    void getProductPanelInfo(productId).then((info) => {
      if (live) setSize({ product: String(productId), name: info?.product_size_name ?? "" });
    });
    return () => {
      live = false;
    };
  }, [productId]);
  const sizeName = productId && size?.product === String(productId) ? size.name || "—" : "—";

  const byName = (n: string) => cf.ungrouped.find((f) => f.name === n);
  const quantity = byName("quantity")!;
  const qtyError = formState.errors.quantity?.message as string | undefined;
  const qtyId = `${cf.idPrefix}-quantity`;

  return (
    <CreateDialog {...cf.dialogProps}>
      <div className="grid gap-[18px] sm:grid-cols-2">
        {LEAD.map((n) => (
          <div key={n} className="sm:col-span-2">
            <CreateField f={byName(n)!} cf={cf} />
          </div>
        ))}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${cf.idPrefix}-size`}>Size</Label>
          <Input id={`${cf.idPrefix}-size`} value={sizeName} readOnly />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={qtyId}>{quantity.label}</Label>
          <Controller
            control={control}
            name="quantity"
            render={({ field: f }) => (
              <QuantityStepper
                id={qtyId}
                name={f.name}
                value={String(f.value ?? "")}
                onChange={f.onChange}
                onBlur={f.onBlur}
                aria-required
                aria-invalid={qtyError ? true : undefined}
                aria-describedby={qtyError ? `${qtyId}-error` : undefined}
              />
            )}
          />
          {qtyError ? (
            <p id={`${qtyId}-error`} data-field-error="quantity" className="text-sm text-destructive">
              {qtyError}
            </p>
          ) : null}
        </div>
        {AFTER.map((n) => {
          const f = byName(n)!;
          return (
            <div key={n} className={cn((f.type === "textarea" || n === "part_number") && "sm:col-span-2")}>
              <CreateField f={f} cf={cf} />
            </div>
          );
        })}
      </div>
      <CreateSections cf={cf} />
    </CreateDialog>
  );
}
