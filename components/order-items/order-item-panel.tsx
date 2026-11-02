"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { formatDate } from "@/components/resource/format";
import { NumberInput } from "@/components/resource/number-input";
import { PanelSection } from "@/components/resource/panel/panel-section";
import { PanelShell, usePanelCloser } from "@/components/resource/panel/panel-shell";
import { savedToast } from "@/components/resource/panel/saved-toast";
import { StatusChips } from "@/components/resource/panel/status-chips";
import { usePanelErrors } from "@/components/resource/panel/use-panel-errors";
import { ReferenceCombobox } from "@/components/resource/reference-combobox";
import { FieldControl } from "@/components/resource/resource-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getOrderPanelInfo, getProductPanelInfo, saveOrderItemPanel } from "@/lib/order-items/panel-actions";
import { ORDER_FIELDS, panelSchema } from "@/lib/order-items/panel-schema";
import { STAGE_NAMES, type StageFlags } from "@/lib/order-items/stages";
import { formFields, getResource, ORDER_STATUS, STAGES } from "@/lib/resources";
import { initialValues } from "@/lib/resources/schema";
import type { FieldDef } from "@/lib/resources/types";
import { cn } from "@/lib/utils";

type Values = Record<string, unknown>;
type Section = "details" | "attributes";

const ITEM_FIELDS = formFields(getResource("order_items"));
const DETAIL_FIELDS = ["part_number", "height", "width", "depth", "comment"];
const SECTION_FIELDS: Record<Section, FieldDef[]> = {
  details: DETAIL_FIELDS.map((n) => ITEM_FIELDS.find((f) => f.name === n)!).filter(Boolean),
  attributes: ITEM_FIELDS.filter((f) => f.group === "Attributes"),
};
const SECTIONS: [Section, string][] = [
  ["details", "Details"],
  ["attributes", "Attributes"],
];
const STAGE_LABEL = Object.fromEntries(STAGES.map(([n, l]) => [n, l.replace(/ Status$/, "")]));
const FOCUS_ORDER = [
  "product_id", "order_id", "quantity", "order_due_date", "order_status",
  ...SECTION_FIELDS.details.map((f) => f.name), ...SECTION_FIELDS.attributes.map((f) => f.name),
];

const sectionOf = (name: string): Section | null =>
  SECTION_FIELDS.details.some((f) => f.name === name) ? "details" : SECTION_FIELDS.attributes.some((f) => f.name === name) ? "attributes" : null;

export type PanelData = Values & {
  id: string;
  order_id: string;
  line_number: number;
  order_item_count: number;
  stageFlags: StageFlags;
};

type OrderInfo = {
  order_id: string;
  order_number: string;
  order_date: string;
  order_item_count: number;
  client_id: string;
  client_name: string;
};

/**
 * The order-item edit panel (spec 06): every field of the item form, plus the
 * order's due date and status, saved together by saveOrderItemPanel. The frame,
 * closing and error handling are the shared panel's (spec 07).
 */
export function OrderItemPanel({
  data,
  baseQuery,
  activeStatus,
  covered = false,
}: {
  data: PanelData;
  baseQuery: string;
  activeStatus: string;
  /** The create dialog is open on top (spec 08). */
  covered?: boolean;
}) {
  const router = useRouter();
  const idPrefix = useId();
  const [pending, startTransition] = useTransition();
  const closer = usePanelCloser(`/order-items${baseQuery ? `?${baseQuery}` : ""}`);
  const [sizeName, setSizeName] = useState(String(data.product_size_name ?? ""));
  const [stageFlags, setStageFlags] = useState<StageFlags>(data.stageFlags);
  const [order, setOrder] = useState<OrderInfo>({
    order_id: String(data.order_id),
    order_number: String(data.order_number ?? ""),
    order_date: String(data.order_date ?? ""),
    order_item_count: Number(data.order_item_count),
    client_id: String(data.client_id ?? ""),
    client_name: String(data.client_name ?? ""),
  });

  const form = useForm<Values>({
    resolver: zodResolver(panelSchema()) as never,
    defaultValues: {
      ...initialValues("order_items", data),
      order_due_date: String(data.order_due_date ?? ""),
      order_status: String(data.order_status ?? "new"),
    },
  });
  const { control, handleSubmit, setValue, setError, setFocus, formState } = form;
  const errors = formState.errors;
  const { open, toggle, showErrors } = usePanelErrors<Section>({ sectionOf, focusOrder: FOCUS_ORDER, setFocus, idPrefix });

  const onSubmit = (values: Values) =>
    startTransition(async () => {
      // Fix 1 (spec 07): the order's Due and Status are sent only when the user changed them
      // (changing Order marks both changed), so a stale panel never overwrites the order.
      const orderChanged = ORDER_FIELDS.some((k) => formState.dirtyFields[k]);
      const payload = { ...values };
      if (!orderChanged) for (const k of ORDER_FIELDS) delete payload[k];
      const result = await saveOrderItemPanel(data.id, payload);
      if (result.ok) {
        savedToast({
          message: result.message,
          router,
          path: "/order-items",
          baseQuery,
          id: data.id,
          activeStatus,
          savedStatus: result.orderStatus,
          options: ORDER_STATUS,
        });
        closer.close({ saved: true });
        return;
      }
      for (const [name, message] of Object.entries(result.fieldErrors ?? {})) setError(name, { message });
      if (result.fieldErrors) showErrors(result.fieldErrors);
      toast.error(`Could not edit Order Item: ${result.error ?? "please check the highlighted fields"}`);
    });

  const onProductChange = async (productId: string) => {
    const info = productId ? await getProductPanelInfo(productId) : null;
    if (info) {
      setSizeName(info.product_size_name);
      setStageFlags(info.stageFlags);
    }
  };

  const onOrderChange = async (orderId: string) => {
    const info = orderId ? await getOrderPanelInfo(orderId) : null;
    if (!info) return;
    setOrder({ order_id: orderId, ...info });
    setValue("order_due_date", info.order_due_date, { shouldDirty: true });
    setValue("order_status", info.order_status, { shouldDirty: true });
  };

  const errorFor = (name: string) => {
    const e = errors[name];
    return e && typeof e.message === "string" ? e.message : undefined;
  };
  const fieldError = (name: string) =>
    errorFor(name) ? (
      <p id={`${idPrefix}-${name}-error`} data-field-error={name} className="text-sm text-destructive">
        {errorFor(name)}
      </p>
    ) : null;

  const stageValues = useWatch({ control, name: STAGE_NAMES }) as unknown as boolean[];
  // Shown: the category's stages, plus any done when the panel opened (still listed after unticking, until saved).
  const listedStages = STAGE_NAMES.filter((n, i) => stageFlags[n] || stageValues[i] || Boolean(formState.defaultValues?.[n]));

  const labelClass = "text-[13px] font-medium text-label";

  return (
    <PanelShell
      regionLabel="Edit order item"
      caption={`${order.order_number} · line ${data.line_number}`}
      captionClassName="font-mono"
      heading={String(data.product_name ?? "")}
      subLink={{ href: `/clients/${order.client_id}`, label: order.client_name }}
      detail={{ href: `/orders/${order.order_id}`, label: "View order" }}
      itemId={String(data.id)}
      isDirty={formState.isDirty}
      pending={pending}
      onSubmit={(e) => void handleSubmit(onSubmit, (errs) => showErrors(errs))(e)}
      closer={closer}
      covered={covered}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-product_id`} className={labelClass}>
          Product
        </Label>
        <Controller
          control={control}
          name="product_id"
          render={({ field: f }) => (
            <ReferenceCombobox
              id={`${idPrefix}-product_id`}
              resource="products"
              value={String(f.value ?? "")}
              onChange={(v) => {
                f.onChange(v);
                void onProductChange(v);
              }}
              invalid={Boolean(errorFor("product_id"))}
            />
          )}
        />
        {fieldError("product_id")}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-order_id`} className={labelClass}>
          Order
        </Label>
        <Controller
          control={control}
          name="order_id"
          render={({ field: f }) => (
            <ReferenceCombobox
              id={`${idPrefix}-order_id`}
              resource="orders"
              value={String(f.value ?? "")}
              onChange={(v) => {
                f.onChange(v);
                void onOrderChange(v);
              }}
              invalid={Boolean(errorFor("order_id"))}
            />
          )}
        />
        {fieldError("order_id")}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-size`} className={labelClass}>
            Size
          </Label>
          <Input id={`${idPrefix}-size`} value={sizeName} readOnly />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-quantity`} className={labelClass}>
            Quantity
          </Label>
          <Controller
            control={control}
            name="quantity"
            render={({ field: f }) => (
              <NumberInput
                id={`${idPrefix}-quantity`}
                name={f.name}
                value={String(f.value ?? "")}
                onChange={f.onChange}
                onBlur={f.onBlur}
                ref={f.ref}
                aria-invalid={errorFor("quantity") ? true : undefined}
              />
            )}
          />
          {fieldError("quantity")}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-created`} className={labelClass}>
            Created
          </Label>
          <Input id={`${idPrefix}-created`} value={formatDate(order.order_date)} readOnly />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-order_due_date`} className={labelClass}>
            Due
          </Label>
          <Controller
            control={control}
            name="order_due_date"
            render={({ field: f }) => (
              <Input
                id={`${idPrefix}-order_due_date`}
                type="date"
                name={f.name}
                value={String(f.value ?? "")}
                onChange={f.onChange}
                onBlur={f.onBlur}
                ref={f.ref}
                aria-invalid={errorFor("order_due_date") ? true : undefined}
                aria-describedby={`${idPrefix}-order-help`}
              />
            )}
          />
          {fieldError("order_due_date")}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className={labelClass}>Status</span>
        <Controller
          control={control}
          name="order_status"
          render={({ field: f }) => (
            <StatusChips
              name={`${idPrefix}-order_status`}
              label="Order status"
              value={String(f.value ?? "")}
              options={ORDER_STATUS}
              onChange={f.onChange}
            />
          )}
        />
        <p id={`${idPrefix}-order-help`} className="text-xs text-muted-foreground">
          Due date and status apply to all {order.order_item_count} items on order {order.order_number}
        </p>
        {fieldError("order_status")}
      </div>

      <div role="group" aria-labelledby={`${idPrefix}-stages`} className="flex flex-col gap-2">
        <span id={`${idPrefix}-stages`} className={labelClass}>
          Stages
        </span>
        {listedStages.length ? (
          <div className="flex flex-wrap gap-2">
            {listedStages.map((n) => (
              <Controller
                key={n}
                control={control}
                name={n}
                render={({ field: f }) => {
                  const on = Boolean(f.value);
                  return (
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => f.onChange(!on)}
                      className={cn(
                        "flex flex-col items-start rounded-md border px-3 py-1.5 text-left text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        on ? "border-primary bg-row-selected text-primary" : "border-input bg-background text-label",
                      )}
                    >
                      {STAGE_LABEL[n]}
                      {!stageFlags[n] ? <span className="text-[11px] text-muted-foreground">Not used by this category</span> : null}
                    </button>
                  );
                }}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No production stages for this category</p>
        )}
      </div>

      {SECTIONS.map(([s, title]) => (
        <PanelSection
          key={s}
          id={`${idPrefix}-${s}`}
          title={title}
          open={Boolean(open[s])}
          onToggle={() => toggle(s)}
          errorCount={SECTION_FIELDS[s].filter((f) => errors[f.name]).length}
        >
          {SECTION_FIELDS[s].map((f) => (
            <div key={f.name} className={cn(f.type === "textarea" && "sm:col-span-2")}>
              <FieldControl field={f} control={control} errors={errors} idPrefix={idPrefix} dependents={[]} setValue={setValue} />
            </div>
          ))}
        </PanelSection>
      ))}
    </PanelShell>
  );
}
