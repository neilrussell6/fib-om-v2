"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpRightIcon, ChevronDownIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Controller, type FieldErrors, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { formatDate } from "@/components/resource/format";
import { NumberInput } from "@/components/resource/number-input";
import { ReferenceCombobox } from "@/components/resource/reference-combobox";
import { FieldControl } from "@/components/resource/resource-form";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { getOrderPanelInfo, getProductPanelInfo, saveOrderItemPanel } from "@/lib/order-items/panel-actions";
import { panelSchema } from "@/lib/order-items/panel-schema";
import { STAGE_NAMES, type StageFlags } from "@/lib/order-items/stages";
import { formFields, getResource, ORDER_STATUS, STAGES } from "@/lib/resources";
import { initialValues } from "@/lib/resources/schema";
import type { FieldDef } from "@/lib/resources/types";
import { type StatusKey, statusColors } from "@/lib/theme/palette";
import { cn } from "@/lib/utils";
import { itemHref } from "./order-items-table";

type Values = Record<string, unknown>;
type Section = "details" | "attributes";

const ITEM_FIELDS = formFields(getResource("order_items"));
const DETAIL_FIELDS = ["part_number", "height", "width", "depth", "comment"];
const SECTION_FIELDS: Record<Section, FieldDef[]> = {
  details: DETAIL_FIELDS.map((n) => ITEM_FIELDS.find((f) => f.name === n)!).filter(Boolean),
  attributes: ITEM_FIELDS.filter((f) => f.group === "Attributes"),
};
const STAGE_LABEL = Object.fromEntries(STAGES.map(([n, l]) => [n, l.replace(/ Status$/, "")]));
const NARROW = "(max-width: 1023.98px)";

function subscribeNarrow(cb: () => void) {
  const mq = window.matchMedia(NARROW);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
/** Below 1024px the panel is a sheet over the list; the server renders the desktop panel. */
const useNarrow = () => useSyncExternalStore(subscribeNarrow, () => window.matchMedia(NARROW).matches, () => false);

const noopSubscribe = () => () => {};
/** False during server render and hydration, true once React owns the inputs. */
const useHydrated = () => useSyncExternalStore(noopSubscribe, () => true, () => false);

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
 * order's due date and status, saved together by saveOrderItemPanel.
 */
export function OrderItemPanel({ data, baseQuery, activeStatus }: { data: PanelData; baseQuery: string; activeStatus: string }) {
  const router = useRouter();
  const narrow = useNarrow();
  const hydrated = useHydrated();
  const idPrefix = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [open, setOpen] = useState<Record<Section, boolean>>({ details: false, attributes: false });
  // The first invalid field, focused after its section has expanded (a ref: no extra render).
  const focusField = useRef<string | null>(null);
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

  // Focus the heading when the panel opens (spec 06 AC-24).
  useEffect(() => {
    headingRef.current?.focus();
  }, [narrow]);

  // Focus the first invalid field once its section has expanded (runs after every render).
  useEffect(() => {
    const name = focusField.current;
    if (!name) return;
    focusField.current = null;
    setFocus(name);
    document.getElementById(`${idPrefix}-${name}`)?.focus();
  });

  // When the panel goes away, focus returns to its row's Order link (spec 06 AC-24).
  // (Opening another row mounts a new panel, which then focuses its own heading.)
  useEffect(() => {
    const id = data.id;
    return () => {
      requestAnimationFrame(() => {
        if (!document.querySelector('[aria-label="Edit order item"]')) document.querySelector<HTMLElement>(`[data-item-link="${id}"]`)?.focus();
      });
    };
  }, [data.id]);

  const close = useCallback(() => {
    router.replace(`/order-items${baseQuery ? `?${baseQuery}` : ""}`, { scroll: false });
  }, [router, baseQuery]);

  const requestClose = useCallback(() => {
    if (formState.isDirty) setConfirmOpen(true);
    else close();
  }, [formState.isDirty, close]);

  // Escape closes (or asks first), unless something inside already handled it.
  useEffect(() => {
    if (narrow) return; // the sheet handles Escape itself
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || confirmOpen) return;
      if (document.querySelector('[data-slot="popover-content"], [role="listbox"]')) return;
      requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [requestClose, confirmOpen, narrow]);

  const showErrors = (errs: FieldErrors<Values> | Record<string, string>) => {
    const names = Object.keys(errs);
    if (!names.length) return;
    const sections = new Set(names.map(sectionOf).filter(Boolean) as Section[]);
    if (sections.size) setOpen((o) => ({ ...o, ...Object.fromEntries([...sections].map((s) => [s, true])) }));
    const order_ = ["product_id", "order_id", "quantity", "order_due_date", "order_status", ...SECTION_FIELDS.details.map((f) => f.name), ...SECTION_FIELDS.attributes.map((f) => f.name)];
    focusField.current = order_.find((n) => names.includes(n)) ?? names[0];
    // Re-render so the effect above runs even when no section had to expand.
    setOpen((o) => ({ ...o }));
  };

  const onSubmit = (values: Values) =>
    startTransition(async () => {
      const result = await saveOrderItemPanel(data.id, values);
      if (result.ok) {
        const moved = activeStatus && result.orderStatus && result.orderStatus !== activeStatus;
        if (moved) {
          const label = ORDER_STATUS.find((o) => o.value === result.orderStatus)?.label ?? result.orderStatus;
          const params = new URLSearchParams(baseQuery);
          params.set("status", result.orderStatus!);
          params.delete("page");
          const viewHref = itemHref(params.toString(), data.id);
          toast.success(`${result.message}. Moved to ${label}.`, { action: { label: "View", onClick: () => router.push(viewHref, { scroll: false }) } });
        } else toast.success(result.message);
        close();
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
  const sectionErrors = (s: Section) => SECTION_FIELDS[s].filter((f) => errors[f.name]).length;

  const stageValues = useWatch({ control, name: STAGE_NAMES }) as unknown as boolean[];
  // Shown: the category's stages, plus any done when the panel opened (still listed after unticking, until saved).
  const listedStages = STAGE_NAMES.filter((n, i) => stageFlags[n] || stageValues[i] || Boolean(formState.defaultValues?.[n]));

  const labelClass = "text-[13px] font-medium text-label";
  const body = (
    <form
      onSubmit={(e) => void handleSubmit(onSubmit, (errs) => showErrors(errs))(e)}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      aria-label="Order item"
    >
      {/* Controls stay disabled until hydration, so nothing typed before then is lost (fix: AC-20). */}
      <fieldset disabled={!hydrated} className="contents [&_:disabled]:opacity-100">
      <div className="flex flex-col gap-2 border-b border-border px-6 py-5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[13px] text-muted-foreground">
            {order.order_number} · line {data.line_number}
          </span>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            title="Close"
            className="flex size-[30px] items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <XIcon aria-hidden="true" className="size-[17px]" />
          </button>
        </div>
        <h2 ref={headingRef} tabIndex={-1} className="text-[22px] leading-tight font-semibold tracking-[-0.01em] text-pretty outline-none">
          {String(data.product_name ?? "")}
        </h2>
        <Link href={`/clients/${order.client_id}`} className="text-sm">
          {order.client_name}
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-6 py-5">
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
          <span id={`${idPrefix}-status-label`} className={labelClass}>
            Status
          </span>
          <Controller
            control={control}
            name="order_status"
            render={({ field: f }) => (
              <div role="radiogroup" aria-label="Order status" className="flex flex-wrap gap-2">
                {ORDER_STATUS.map((o) => {
                  const on = f.value === o.value;
                  const c = statusColors[o.value as StatusKey];
                  return (
                    <label
                      key={o.value}
                      className="relative cursor-pointer rounded-md border px-3 py-1.5 text-[13px] has-focus-visible:ring-2 has-focus-visible:ring-ring"
                      style={on ? { borderColor: c.fg, backgroundColor: c.bg, color: c.fg } : { borderColor: "var(--input)", backgroundColor: "#ffffff", color: "var(--label)" }}
                    >
                      <input
                        type="radio"
                        name={`${idPrefix}-order_status`}
                        value={o.value}
                        checked={on}
                        onChange={() => f.onChange(o.value)}
                        className="absolute inset-0 m-0 cursor-pointer appearance-none opacity-0"
                      />
                      {o.label}
                    </label>
                  );
                })}
              </div>
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

        {(["details", "attributes"] as const).map((s) => {
          const n = sectionErrors(s);
          const title = s === "details" ? "Details" : "Attributes";
          return (
            <div key={s} className="flex flex-col gap-3 border-t border-border pt-3">
              <button
                type="button"
                aria-expanded={open[s]}
                aria-controls={`${idPrefix}-${s}`}
                onClick={() => setOpen((o) => ({ ...o, [s]: !o[s] }))}
                className="flex items-center justify-between text-left text-[13px] font-medium text-label outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span>
                  {title}
                  {n ? <span className="text-destructive">{` · ${n} error${n === 1 ? "" : "s"}`}</span> : null}
                </span>
                <ChevronDownIcon aria-hidden="true" className={cn("size-4 text-icon-muted transition-transform", open[s] && "rotate-180")} />
              </button>
              {open[s] ? (
                <div id={`${idPrefix}-${s}`} className="grid gap-4 sm:grid-cols-2">
                  {SECTION_FIELDS[s].map((f) => (
                    <div key={f.name} className={cn(f.type === "textarea" && "sm:col-span-2")}>
                      <FieldControl field={f} control={control} errors={errors} idPrefix={idPrefix} dependents={[]} setValue={setValue} />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 border-t border-border px-6 py-4">
        <Link href={`/orders/${order.order_id}`} className="flex items-center gap-1.5 text-sm">
          View order <ArrowUpRightIcon aria-hidden="true" className="size-3.5" />
        </Link>
        <Button type="button" variant="outline" className="ml-auto" onClick={requestClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>

      </fieldset>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>Your changes to this order item haven&apos;t been saved.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Keep editing
            </Button>
            <Button
              type="button"
              onClick={() => {
                setConfirmOpen(false);
                close();
              }}
            >
              Discard
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );

  if (narrow) {
    return (
      <Sheet open onOpenChange={(next) => (next ? null : requestClose())}>
        <SheetContent side="right" showCloseButton={false} aria-label="Edit order item" className="w-full gap-0 bg-surface p-0 sm:max-w-[400px]">
          <SheetTitle className="sr-only">Edit order item</SheetTitle>
          {body}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <section
      aria-label="Edit order item"
      className="flex w-[min(400px,42vw)] min-w-[320px] shrink-0 flex-col border-l border-border bg-surface print:hidden"
    >
      {body}
    </section>
  );
}
