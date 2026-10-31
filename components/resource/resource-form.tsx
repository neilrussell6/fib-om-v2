"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";
import { type Control, Controller, type FieldErrors, useForm, type UseFormSetValue, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formFields, getResource } from "@/lib/resources";
import { saveRecord } from "@/lib/resources/actions";
import { buildSchema, initialValues } from "@/lib/resources/schema";
import type { FieldDef, ResourceKey } from "@/lib/resources/types";
import { cn } from "@/lib/utils";
import { NumberInput } from "./number-input";
import { ReferenceCombobox } from "./reference-combobox";

type Values = Record<string, unknown>;

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive";

function errorText(errors: FieldErrors<Values>, name: string): string | undefined {
  const e = errors[name];
  return e && typeof e.message === "string" ? e.message : undefined;
}

function FieldControl({
  field,
  control,
  errors,
  idPrefix,
  dependents,
  setValue,
}: {
  field: FieldDef;
  control: Control<Values>;
  errors: FieldErrors<Values>;
  /** Unique per form instance: hidden, preserved routes can hold another form with the same fields (review 02, finding 2). */
  idPrefix: string;
  /** Fields whose options depend on this one (cleared when it changes; review 02, finding 5). */
  dependents: string[];
  setValue: UseFormSetValue<Values>;
}) {
  const error = errorText(errors, field.name);
  const id = `${idPrefix}-${field.name}`;
  const errorId = `${id}-error`;
  const aria = {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
    "aria-required": field.required || undefined,
  };
  const refFilterValue = useWatch({ control, name: field.refFilter?.from ?? "__none__" }) as string | undefined;

  if (field.type === "boolean") {
    return (
      <div className="flex items-center gap-3">
        <Controller
          control={control}
          name={field.name}
          render={({ field: f }) => (
            <Switch id={id} aria-label={field.label} checked={Boolean(f.value)} onCheckedChange={(v) => f.onChange(v)} onBlur={f.onBlur} />
          )}
        />
        <Label htmlFor={id}>{field.label}</Label>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-1">
        <Label htmlFor={id}>{field.label}</Label>
        {/* Outside the label, so the field's accessible name is exactly its label. */}
        {field.required ? (
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        ) : null}
      </div>
      <Controller
        control={control}
        name={field.name}
        render={({ field: f }) => {
          const value = (f.value ?? "") as string;
          switch (field.type) {
            case "number":
              return <NumberInput id={id} name={f.name} value={value} onChange={f.onChange} onBlur={f.onBlur} ref={f.ref} {...aria} />;
            case "textarea":
              return <Textarea id={id} name={f.name} value={value} onChange={f.onChange} onBlur={f.onBlur} ref={f.ref} {...aria} />;
            case "select":
              return (
                <select id={id} name={f.name} value={value} onChange={f.onChange} onBlur={f.onBlur} ref={f.ref} className={selectClass} {...aria}>
                  {field.default === undefined ? <option value="">—</option> : null}
                  {field.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              );
            case "reference":
              return (
                <ReferenceCombobox
                  id={id}
                  resource={field.ref!}
                  value={value}
                  onChange={(v) => {
                    f.onChange(v);
                    f.onBlur();
                    for (const d of dependents) setValue(d, "");
                  }}
                  clientId={field.refFilter ? (refFilterValue ?? "") : undefined}
                  allowClear={!field.required}
                  invalid={Boolean(error)}
                  describedBy={error ? errorId : undefined}
                />
              );
            default:
              return (
                <Input
                  id={id}
                  name={f.name}
                  type={field.type === "email" ? "email" : field.type === "password" ? "password" : field.type === "date" ? "date" : "text"}
                  autoComplete={field.type === "password" ? "new-password" : undefined}
                  value={value}
                  onChange={f.onChange}
                  onBlur={f.onBlur}
                  ref={f.ref}
                  {...aria}
                />
              );
          }
        }}
      />
      {field.type === "password" && !field.required ? (
        <p className="text-xs text-muted-foreground">At least 12 characters.</p>
      ) : null}
      {error ? (
        <p id={errorId} data-field-error={field.name} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Create/edit form for any resource (spec 02): validated with the shared zod
 * schema on blur and again by the Server Action; nothing is applied until the
 * server confirms; success and failure are reported with toasts.
 */
export function ResourceForm({
  resourceKey,
  id,
  record,
}: {
  resourceKey: ResourceKey;
  id?: number | string;
  record?: Values;
}) {
  const ui = getResource(resourceKey);
  const mode = id === undefined ? "create" : "edit";
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const idPrefix = useId();
  const { control, handleSubmit, setError, setValue, formState } = useForm<Values>({
    resolver: zodResolver(buildSchema(resourceKey, mode)) as never,
    defaultValues: initialValues(resourceKey, record),
    mode: "onBlur",
  });

  const onSubmit = (values: Values) =>
    startTransition(async () => {
      const result = await saveRecord(resourceKey, id ?? null, values);
      if (result.ok) {
        toast.success(result.message);
        router.push(result.redirectTo);
        router.refresh();
        return;
      }
      for (const [name, message] of Object.entries(result.fieldErrors ?? {})) setError(name, { message });
      toast.error(`Could not ${mode === "create" ? "create" : "edit"} ${ui.singular}: ${result.error ?? "please check the highlighted fields"}`);
    });

  const fields = formFields(ui).map((f) => (mode === "edit" && f.type === "password" ? { ...f, required: false } : f));
  const ungrouped = fields.filter((f) => !f.group);
  const groups = [...new Set(fields.filter((f) => f.group).map((f) => f.group!))];
  const busy = pending || formState.isSubmitting;
  const dependentsOf = (name: string) => fields.filter((f) => f.refFilter?.from === name).map((f) => f.name);
  const control_ = (f: FieldDef) => (
    <FieldControl
      field={f}
      control={control}
      errors={formState.errors}
      idPrefix={idPrefix}
      dependents={dependentsOf(f.name)}
      setValue={setValue}
    />
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex max-w-3xl flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {ungrouped.map((f) => (
          <div key={f.name} className={cn(f.type === "textarea" && "sm:col-span-2")}>
            {control_(f)}
          </div>
        ))}
      </div>
      {groups.length ? (
        <div className="flex flex-col gap-4">
          {ui.formHeading ? <h2 className="text-lg font-semibold text-secondary">{ui.formHeading}</h2> : null}
          {groups.map((g) => (
            <fieldset key={g} className="rounded-md border p-4">
              <legend className="px-1 text-sm font-semibold text-secondary">{g}</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                {fields
                  .filter((f) => f.group === g)
                  .map((f) => (
                    <div key={f.name}>{control_(f)}</div>
                  ))}
              </div>
            </fieldset>
          ))}
        </div>
      ) : null}
      <div>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
