"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { type FieldErrors, useForm } from "react-hook-form";
import { toast } from "sonner";
import { formFields, getResource, resourceAddLabel, resourceCreateTitle, type ResourceKey } from "@/lib/resources";
import { saveRecord } from "@/lib/resources/actions";
import { buildSchema, initialValues } from "@/lib/resources/schema";
import type { FieldDef } from "@/lib/resources/types";
import { cn } from "@/lib/utils";
import { clearOpenedMarker } from "../panel/history";
import { PanelSection } from "../panel/panel-section";
import { usePanelErrors } from "../panel/use-panel-errors";
import { FieldControl } from "../resource-form";
import { CreateDialog, useCreateCloser } from "./create-dialog";

type Values = Record<string, unknown>;

/**
 * The create dialog's form logic (spec 08), shared by every body: the create page's
 * schema, defaults and Server Action; Create another (reset, keeping `keep`, and focus
 * on the first field that was reset); the docket's replace to its detail page; and the
 * panels' error handling.
 */
export function useCreateForm({ resourceKey, baseQuery, keep = [], focusOrder }: { resourceKey: ResourceKey; baseQuery: string; keep?: string[]; focusOrder?: string[] }) {
  const ui = getResource(resourceKey);
  const router = useRouter();
  const idPrefix = useId();
  const [pending, startTransition] = useTransition();
  const [createAnother, setCreateAnother] = useState(false);
  const submitting = useRef(false);
  const closer = useCreateCloser(`${ui.path}${baseQuery ? `?${baseQuery}` : ""}`);

  // Users: the password is required on create (as on the create page).
  const fields = formFields(ui).map((f) => (f.type === "password" ? { ...f, required: true } : f));
  const ungrouped = fields.filter((f) => !f.group);
  const groups = [...new Set(fields.filter((f) => f.group).map((f) => f.group!))];
  const groupOf = (name: string) => fields.find((f) => f.name === name)?.group ?? null;
  const dependentsOf = (name: string) => fields.filter((f) => f.refFilter?.from === name).map((f) => f.name);
  const order = focusOrder ?? [...ungrouped, ...groups.flatMap((g) => fields.filter((f) => f.group === g))].map((f) => f.name);

  const form = useForm<Values>({
    resolver: zodResolver(buildSchema(resourceKey, "create")) as never,
    defaultValues: initialValues(resourceKey),
  });
  const { getValues, reset, setError, setFocus } = form;
  const { open, toggle, showErrors } = usePanelErrors<string>({ sectionOf: groupOf, focusOrder: order, setFocus, idPrefix });

  const focusField = (name: string | undefined) => {
    if (!name) return;
    // After the reset has rendered.
    requestAnimationFrame(() => document.getElementById(`${idPrefix}-${name}`)?.focus());
  };

  const onValid = (values: Values) => {
    // A double click submits once (AC-13): the transition's pending flag lands a render later.
    if (submitting.current) return;
    submitting.current = true;
    startTransition(async () => {
      try {
        const result = await saveRecord(resourceKey, null, values);
        if (result.ok) {
          toast.success(result.message);
          if (ui.afterCreate === "detail") {
            // Replace the dialog's entry, so Back from the new record returns to the list.
            closer.closed.current = true;
            clearOpenedMarker(`${window.location.pathname}${window.location.search}`);
            router.replace(result.redirectTo);
            return;
          }
          if (createAnother) {
            const kept = Object.fromEntries(keep.map((k) => [k, getValues(k)]));
            reset({ ...initialValues(resourceKey), ...kept });
            focusField(order.find((n) => !keep.includes(n)));
            router.refresh();
            return;
          }
          closer.close({ saved: true });
          return;
        }
        for (const [name, message] of Object.entries(result.fieldErrors ?? {})) setError(name, { message });
        if (result.fieldErrors) showErrors(result.fieldErrors);
        toast.error(`Could not create ${ui.singular}: ${result.error ?? "please check the highlighted fields"}`);
      } finally {
        submitting.current = false;
      }
    });
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => void form.handleSubmit(onValid, (errs) => showErrors(errs))(e);

  const dialogProps = {
    title: resourceCreateTitle(ui),
    description: ui.createDescription,
    addLabel: resourceAddLabel(ui),
    allowCreateAnother: ui.afterCreate !== "detail",
    createAnother,
    onCreateAnotherChange: setCreateAnother,
    isDirty: form.formState.isDirty,
    pending,
    onSubmit,
    closer,
  };

  return { ui, form, fields, ungrouped, groups, dependentsOf, idPrefix, open, toggle, dialogProps };
}

export type CreateForm = ReturnType<typeof useCreateForm>;

/** One field with the dialog's "(optional)" label style. */
export function CreateField({ f, cf }: { f: FieldDef; cf: CreateForm }) {
  return (
    <FieldControl
      field={f}
      control={cf.form.control}
      errors={cf.form.formState.errors as FieldErrors<Values>}
      idPrefix={cf.idPrefix}
      dependents={cf.dependentsOf(f.name)}
      setValue={cf.form.setValue}
      optionalHint
    />
  );
}

/** The form heading and one collapsed section per group, with its error count. */
export function CreateSections({ cf }: { cf: CreateForm }) {
  const errors = cf.form.formState.errors;
  return (
    <>
      {cf.groups.length && cf.ui.formHeading ? <h3 className="text-[13px] font-semibold text-label">{cf.ui.formHeading}</h3> : null}
      {cf.groups.map((g) => {
        const inGroup = cf.fields.filter((f) => f.group === g);
        return (
          <PanelSection
            key={g}
            id={`${cf.idPrefix}-group-${g.replace(/\W+/g, "-")}`}
            title={g}
            open={Boolean(cf.open[g])}
            onToggle={() => cf.toggle(g)}
            errorCount={inGroup.filter((f) => errors[f.name]).length}
          >
            {inGroup.map((f) => (
              <div key={f.name} className={cn(f.type === "textarea" && "sm:col-span-2")}>
                <CreateField f={f} cf={cf} />
              </div>
            ))}
          </PanelSection>
        );
      })}
    </>
  );
}

/**
 * The create dialog for any resource (spec 08): every field of its create form, with
 * the same controls, defaults, rules and dependencies as the create page.
 */
export function RecordCreateForm({ resourceKey, baseQuery }: { resourceKey: ResourceKey; baseQuery: string }) {
  const cf = useCreateForm({ resourceKey, baseQuery });
  return (
    <CreateDialog {...cf.dialogProps}>
      {cf.ungrouped.length ? (
        <div className="grid gap-[18px] sm:grid-cols-2">
          {cf.ungrouped.map((f) => (
            <div key={f.name} className={cn(f.type === "textarea" && "sm:col-span-2")}>
              <CreateField f={f} cf={cf} />
            </div>
          ))}
        </div>
      ) : null}
      <CreateSections cf={cf} />
    </CreateDialog>
  );
}
