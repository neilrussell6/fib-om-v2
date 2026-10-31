import { z } from "zod";
import { emailSchema, passwordSchema } from "@/lib/validation/auth";
import { type FieldDef, formFields, getResource, type ResourceKey } from "./index";

/**
 * One zod schema per resource and mode, shared by the form (client) and the
 * Server Action (server). Parsing is idempotent: parsed output parses again
 * to the same value, so the action can re-validate what the form sends.
 */

const REQUIRED = "Required";
const blank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

function textField(f: FieldDef) {
  const base = z.string().trim();
  return f.required
    ? z.preprocess((v) => (v === null || v === undefined ? "" : v), base.min(1, REQUIRED))
    : z.preprocess((v) => (blank(v) ? null : v), base.nullable());
}

function numberField(f: FieldDef) {
  const n = z.number({ error: "please provide a valid integer" }).int("please provide a valid integer");
  const toNumber = (v: unknown) => (blank(v) ? null : typeof v === "string" ? Number(v.trim()) : v);
  return f.required
    ? z.preprocess(toNumber, n.nullable().refine((v) => v !== null, REQUIRED))
    : z.preprocess(toNumber, n.nullable());
}

function dateField(f: FieldDef) {
  const d = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "please provide a valid date");
  return f.required
    ? z.preprocess((v) => (blank(v) ? null : v), d.nullable().refine((v) => v !== null, REQUIRED))
    : z.preprocess((v) => (blank(v) ? null : v), d.nullable());
}

function selectField(f: FieldDef) {
  const values = (f.options ?? []).map((o) => o.value) as [string, ...string[]];
  const e = z.enum(values, { error: "please choose one of the options" });
  if (f.default !== undefined) return z.preprocess((v) => (blank(v) ? f.default : v), e);
  return f.required
    ? z.preprocess((v) => (blank(v) ? null : v), e.nullable().refine((v) => v !== null, REQUIRED))
    : z.preprocess((v) => (blank(v) ? null : v), e.nullable());
}

function referenceField(f: FieldDef) {
  const id = z.number({ error: REQUIRED }).int().positive();
  const toId = (v: unknown) => (blank(v) ? null : Number(v));
  return f.required
    ? z.preprocess(toId, id.nullable().refine((v) => v !== null, REQUIRED))
    : z.preprocess(toId, id.nullable());
}

const booleanField = () =>
  z.preprocess((v) => v === true || v === "true" || v === "on", z.boolean());

function fieldSchema(key: ResourceKey, mode: "create" | "edit", f: FieldDef): z.ZodType {
  if (f.type === "email") return z.preprocess((v) => (v === null || v === undefined ? "" : v), emailSchema);
  if (f.type === "password") {
    // Users: required on create; on edit a blank password keeps the current one.
    return mode === "create"
      ? z.preprocess((v) => (v === null || v === undefined ? "" : v), passwordSchema)
      : z.preprocess((v) => (blank(v) ? undefined : v), passwordSchema.optional());
  }
  switch (f.type) {
    case "number":
      return numberField(f);
    case "date":
      return dateField(f);
    case "boolean":
      return booleanField();
    case "select":
      return selectField(f);
    case "reference":
      return referenceField(f);
    default:
      return textField(f);
  }
}

export function buildSchema(key: ResourceKey, mode: "create" | "edit") {
  const shape: Record<string, z.ZodType> = {};
  for (const f of formFields(getResource(key))) shape[f.name] = fieldSchema(key, mode, f);
  return z.object(shape);
}

/** Initial form values: defaults on create, the stored values on edit. */
export function initialValues(key: ResourceKey, record?: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of formFields(getResource(key))) {
    if (f.type === "password") out[f.name] = "";
    else if (record) {
      const v = record[f.name];
      out[f.name] = f.type === "boolean" ? Boolean(v) : v === null || v === undefined ? "" : String(v);
    } else out[f.name] = f.type === "boolean" ? (f.default ?? false) : (f.default ?? "");
  }
  return out;
}
