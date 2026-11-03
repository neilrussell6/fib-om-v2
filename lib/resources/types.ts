/**
 * Client-safe description of a resource: fields, list columns, filters.
 * The SQL side (allowlisted columns and fragments) lives in lib/db/queries/<resource>.ts.
 */

export const RESOURCE_KEYS = [
  "users",
  "clients",
  "product_categories",
  "product_types",
  "product_sizes",
  "product_media",
  "products",
  "orders",
  "order_items",
  "delivery_dockets",
] as const;

export type ResourceKey = (typeof RESOURCE_KEYS)[number];

export function isResourceKey(value: unknown): value is ResourceKey {
  return typeof value === "string" && (RESOURCE_KEYS as readonly string[]).includes(value);
}

export type Option = { value: string; label: string };

export type FieldType = "text" | "textarea" | "email" | "password" | "number" | "date" | "boolean" | "select" | "reference";

export type FieldDef = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: Option[];
  /** Initial value on the create form. */
  default?: string | boolean;
  /** Referenced resource (type "reference"). */
  ref?: ResourceKey;
  /** Narrows reference options by another field's value (e.g. dockets by the order's client). */
  refFilter?: { param: "clientId"; from: string };
  /** Column in the list/detail view row holding the display text for a reference. */
  display?: string;
  /**
   * View-row columns whose values, joined with " · ", make the same label the reference
   * combobox shows (`QUERIES[ref].options.label`), where that differs from `display` (spec 09 P3).
   */
  displayLabel?: string[];
  /** Form section, rendered as a labelled group. */
  group?: string;
  /** false: not on the form (detail only). */
  form?: boolean;
  /** false: not on the detail page. */
  detail?: boolean;
  /** Rendered as status chips in the edit panel (spec 07); forms keep their select. */
  chips?: true;
};

export type ColumnFormat = "text" | "date" | "enum";

export type ColumnDef = {
  /** View column shown in the cell; also the sort key. */
  key: string;
  label: string;
  format?: ColumnFormat;
  options?: Option[];
  /** Renders the cell as a link to another resource's detail page. */
  link?: { path: string; idKey: string };
  /** Right-aligned with tabular figures (quantities). */
  align?: "right";
};

export type FilterKind = "text" | "reference" | "select" | "date" | "number";

export type FilterDef = {
  /** URL query key; also the key the list query allowlists. */
  key: string;
  label: string;
  kind: FilterKind;
  ref?: ResourceKey;
  options?: Option[];
  alwaysShown?: boolean;
};

export type ResourceUi = {
  key: ResourceKey;
  path: string;
  singular: string;
  plural: string;
  /** List page heading (sentence case); defaults to `plural` with only its first letter capitalised (spec 06). */
  title?: string;
  /** The list's create button; defaults to `New <singular in lower case>` (spec 06). */
  newLabel?: string;
  /** The create dialog's description under its title (spec 08). */
  createDescription: string;
  /** The field used as the panel heading and the title cell's link text (spec 07). */
  titleField: string;
  fields: FieldDef[];
  /** Heading shown above the grouped fields on the form (product categories). */
  formHeading?: string;
  /** Where a successful create goes: the list (default) or the new record's detail page. */
  afterCreate?: "list" | "detail";
  list: {
    columns: ColumnDef[];
    defaultSort: { key: string; dir: "asc" | "desc" };
    filters: FilterDef[];
    /** Status tabs with counts above the list (spec 06, generalised in spec 07): the status column and its options. */
    statusTabs?: { key: string; options: Option[] };
  };
};
