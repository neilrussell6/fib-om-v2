"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";
import { Controller, type FieldErrors, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formFields, getResource, recordTitle, type ResourceKey, singularLabel } from "@/lib/resources";
import { saveRecord } from "@/lib/resources/actions";
import { buildSchema, initialValues } from "@/lib/resources/schema";
import type { FieldDef, ResourceUi } from "@/lib/resources/types";
import { cn } from "@/lib/utils";
import { formatValue } from "./format";
import { PanelSection } from "./panel/panel-section";
import { PanelShell, usePanelCloser } from "./panel/panel-shell";
import { savedToast } from "./panel/saved-toast";
import { StatusChips } from "./panel/status-chips";
import { usePanelErrors } from "./panel/use-panel-errors";
import { FieldControl } from "./resource-form";

type Values = Record<string, unknown>;

/** The link under the heading (spec 07): the order's client, the docket's To client. */
function subLinkFor(key: ResourceKey, record: Values): { href: string; label: string } | null {
  if (key === "orders" && record.client_id) return { href: `/clients/${record.client_id}`, label: String(record.client_name ?? "") };
  if (key === "delivery_dockets" && record.to_client_id) return { href: `/clients/${record.to_client_id}`, label: String(record.to_client_name ?? "") };
  return null;
}

/** Detail-only fields (not on the form), shown read-only at the top (spec 07). */
const readOnlyFields = (ui: ResourceUi) => ui.fields.filter((f) => f.form === false && f.detail !== false);

function readOnlyValue(f: FieldDef, record: Values): string {
  const raw = f.type === "reference" && f.display ? record[f.display] : record[f.name];
  return formatValue(raw, f.type, f.options);
}

const errorText = (errors: FieldErrors<Values>, name: string) => {
  const e = errors[name];
  return e && typeof e.message === "string" ? e.message : undefined;
};

/**
 * The edit panel for any resource (spec 07): every field of its edit form, with
 * the same rules, dependencies and Server Action as the edit page.
 */
export function RecordPanel({
  resourceKey,
  record,
  baseQuery,
  activeStatus,
  covered = false,
}: {
  resourceKey: ResourceKey;
  record: Values;
  baseQuery: string;
  activeStatus: string;
  /** The create dialog is open on top (spec 08). */
  covered?: boolean;
}) {
  const ui = getResource(resourceKey);
  const router = useRouter();
  const idPrefix = useId();
  const [pending, startTransition] = useTransition();
  const id = String(record.id);
  const closer = usePanelCloser(`${ui.path}${baseQuery ? `?${baseQuery}` : ""}`);

  // As on the edit page: a blank password keeps the current one.
  const fields = formFields(ui).map((f) => (f.type === "password" ? { ...f, required: false } : f));
  const ungrouped = fields.filter((f) => !f.group);
  const groups = [...new Set(fields.filter((f) => f.group).map((f) => f.group!))];
  const groupOf = (name: string) => fields.find((f) => f.name === name)?.group ?? null;
  const dependentsOf = (name: string) => fields.filter((f) => f.refFilter?.from === name).map((f) => f.name);

  const { control, handleSubmit, setError, setValue, setFocus, formState } = useForm<Values>({
    resolver: zodResolver(buildSchema(resourceKey, "edit")) as never,
    defaultValues: initialValues(resourceKey, record),
  });
  const errors = formState.errors;
  const { open, toggle, showErrors } = usePanelErrors<string>({
    sectionOf: groupOf,
    focusOrder: [...ungrouped, ...groups.flatMap((g) => fields.filter((f) => f.group === g))].map((f) => f.name),
    setFocus,
    idPrefix,
  });

  const onSubmit = (values: Values) =>
    startTransition(async () => {
      const result = await saveRecord(resourceKey, id, values);
      if (result.ok) {
        const tabs = ui.list.statusTabs;
        savedToast({
          message: result.message,
          router,
          path: ui.path,
          baseQuery,
          id,
          activeStatus,
          savedStatus: tabs ? String(values[tabs.key] ?? "") : undefined,
          options: tabs?.options,
        });
        closer.close({ saved: true });
        return;
      }
      for (const [name, message] of Object.entries(result.fieldErrors ?? {})) setError(name, { message });
      if (result.fieldErrors) showErrors(result.fieldErrors);
      toast.error(`Could not edit ${ui.singular}: ${result.error ?? "please check the highlighted fields"}`);
    });

  const control_ = (f: FieldDef) => {
    if (f.chips && f.options) {
      const error = errorText(errors, f.name);
      return (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-label">{f.label}</span>
          <Controller
            control={control}
            name={f.name}
            render={({ field }) => (
              <StatusChips
                name={`${idPrefix}-${f.name}`}
                label={f.label}
                value={String(field.value ?? "")}
                options={f.options!}
                onChange={field.onChange}
              />
            )}
          />
          {error ? (
            <p data-field-error={f.name} className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      );
    }
    return <FieldControl field={f} control={control} errors={errors} idPrefix={idPrefix} dependents={dependentsOf(f.name)} setValue={setValue} />;
  };

  return (
    <PanelShell
      regionLabel={`Edit ${ui.singular.toLowerCase()}`}
      caption={singularLabel(ui)}
      heading={recordTitle(ui, record)}
      subLink={subLinkFor(resourceKey, record)}
      detail={{ href: `${ui.path}/${id}`, label: `View ${ui.singular.toLowerCase()}` }}
      itemId={id}
      isDirty={formState.isDirty}
      pending={pending}
      onSubmit={(e) => void handleSubmit(onSubmit, (errs) => showErrors(errs))(e)}
      closer={closer}
      covered={covered}
    >
      {readOnlyFields(ui).length ? (
        <div className="grid grid-cols-2 gap-3">
          {readOnlyFields(ui).map((f) => (
            <div key={f.name} className="flex flex-col gap-1.5">
              <Label htmlFor={`${idPrefix}-ro-${f.name}`} className="text-[13px] font-medium text-label">
                {f.label}
              </Label>
              <Input id={`${idPrefix}-ro-${f.name}`} value={readOnlyValue(f, record)} readOnly />
            </div>
          ))}
        </div>
      ) : null}

      {ungrouped.map((f) => (
        <div key={f.name}>{control_(f)}</div>
      ))}

      {groups.length && ui.formHeading ? <h3 className="text-[13px] font-semibold text-label">{ui.formHeading}</h3> : null}
      {groups.map((g) => {
        const inGroup = fields.filter((f) => f.group === g);
        return (
          <PanelSection
            key={g}
            id={`${idPrefix}-group-${g.replace(/\W+/g, "-")}`}
            title={g}
            open={Boolean(open[g])}
            onToggle={() => toggle(g)}
            errorCount={inGroup.filter((f) => errors[f.name]).length}
          >
            {inGroup.map((f) => (
              <div key={f.name} className={cn(f.type === "textarea" && "sm:col-span-2")}>
                {control_(f)}
              </div>
            ))}
          </PanelSection>
        );
      })}
    </PanelShell>
  );
}
