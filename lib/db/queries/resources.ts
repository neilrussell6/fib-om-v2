import type { ResourceKey } from "@/lib/resources/types";

/**
 * Server-side, allowlisted SQL for every resource (overview O5). Every
 * identifier and fragment here is a code constant; user input only ever
 * reaches SQL as a $n parameter.
 */

export type FilterSql =
  | { kind: "contains"; column: string }
  | { kind: "eq"; column: string; cast?: string }
  | { kind: "gte"; column: string; cast: string }
  | { kind: "lte"; column: string; cast: string };

export type QueryConfig = {
  /** Base table written by create, update and delete. */
  table: string;
  /** Table or view read by lists and detail pages. */
  source: string;
  /** Columns read by lists and detail pages (never password hashes). */
  select: string;
  /** Columns the Server Actions may write. */
  writable: string[];
  /** Sort key → column. */
  sorts: Record<string, string>;
  /** Filter key → SQL condition. */
  filters: Record<string, FilterSql>;
  /** Reference-combobox options: label expression, extra conditions, order. */
  options: { source: string; label: string; orderBy: string; byClientColumn?: string };
};

const contains = (column: string): FilterSql => ({ kind: "contains", column });
const eq = (column: string, cast?: string): FilterSql => ({ kind: "eq", column, cast });
const between = (key: string, column: string, cast: string): Record<string, FilterSql> => ({
  [`${key}_from`]: { kind: "gte", column, cast },
  [`${key}_to`]: { kind: "lte", column, cast },
});

export const QUERIES: Record<ResourceKey, QueryConfig> = {
  users: {
    table: "users",
    source: "users",
    select: "id, email, created_at",
    writable: ["email", "password_hash"],
    sorts: { email: "email" },
    filters: { email: contains("email") },
    options: { source: "users", label: "email", orderBy: "email" },
  },
  clients: {
    table: "clients",
    source: "clients",
    select: "*",
    writable: [
      "name", "full_name", "phone", "address_shipping", "address_billing", "abn", "acn", "fax", "landline",
      "label_reorder_text", "label_name", "label_sub_name", "label_address_line1", "label_address_line2", "label_use_part_number",
    ],
    sorts: { name: "name", full_name: "full_name", phone: "phone", address_shipping: "address_shipping" },
    filters: { name: contains("name") },
    options: { source: "clients", label: "name", orderBy: "name" },
  },
  product_categories: {
    table: "product_categories",
    source: "product_categories",
    select: "*",
    writable: [
      "name", "show_product_type_code", "show_product_type_name", "show_product_size_name", "show_product_media_code",
      "show_quantity", "show_height", "show_width", "show_depth", "show_has_wire_header", "show_has_header_frame", "show_type",
      "show_number", "show_clip_type", "show_clip_position", "show_has_gasket", "show_pockets", "show_has_legs", "show_wire_mesh",
      "show_has_gate", "show_calculated_id", "show_wire_sides", "show_pleats", "show_wire_metres", "show_wire_height",
      "show_media_mats", "show_gasket", "show_drawing_number", "show_cut_count", "show_sow_count", "show_cut_status",
      "show_sow_status", "show_frame_status", "show_media_status", "show_wire_status", "show_package_status", "show_assemble_status",
    ],
    sorts: { name: "name" },
    filters: { name: contains("name") },
    options: { source: "product_categories", label: "name", orderBy: "name" },
  },
  product_types: {
    table: "product_types",
    source: "product_types",
    select: "*",
    writable: ["name", "code", "millimetres_per_pleat"],
    sorts: { name: "name", code: "code", millimetres_per_pleat: "millimetres_per_pleat" },
    filters: { name: contains("name"), code: contains("code") },
    options: { source: "product_types", label: "code || ' · ' || name", orderBy: "code" },
  },
  product_sizes: {
    table: "product_sizes",
    source: "product_sizes",
    select: "*",
    writable: ["name"],
    sorts: { name: "name" },
    filters: { name: contains("name") },
    options: { source: "product_sizes", label: "name", orderBy: "name" },
  },
  product_media: {
    table: "product_media",
    source: "product_media",
    select: "*",
    writable: ["name", "code", "pleat_spacing"],
    sorts: { name: "name", code: "code", pleat_spacing: "pleat_spacing" },
    filters: { name: contains("name"), code: contains("code") },
    options: { source: "product_media", label: "code || ' · ' || name", orderBy: "code" },
  },
  products: {
    table: "products",
    source: "products_v",
    select: "*",
    writable: ["name", "category_id", "type_id", "size_id", "media_id", "notcher", "efficiency"],
    sorts: {
      category_name: "category_name", type_name: "type_name", type_code: "type_code", name: "name",
      size_name: "size_name", media_name: "media_name",
    },
    filters: {
      name: contains("name"),
      // Spec 02 improvement: the type filter matches type_id (web3 put the id onto type_name).
      type: eq("type_id", "bigint"),
      size: contains("size_name"),
      media: contains("media_name"),
      category: eq("category_id", "bigint"),
      efficiency: contains("efficiency"),
    },
    options: { source: "products_v", label: "name", orderBy: "name" },
  },
  delivery_dockets: {
    table: "delivery_dockets",
    source: "delivery_dockets_v",
    select: "*",
    writable: ["to_client_id", "status", "from_client_id"],
    sorts: { to_client_name: "to_client_name", docket_number: "docket_number", date: "date", status: "status" },
    filters: {
      to_client: contains("to_client_name"),
      docket_number: contains("docket_number"),
      ...between("created", "date", "date"),
      status: eq("status", "docket_status"),
    },
    options: { source: "delivery_dockets_v", label: "docket_number", orderBy: "id DESC", byClientColumn: "to_client_id" },
  },
  orders: {
    table: "orders",
    source: "orders_v",
    select: "*",
    writable: ["client_id", "order_number", "due_date", "status", "delivery_docket_id"],
    sorts: {
      client_name: "client_name", order_number: "order_number", delivery_docket_number: "delivery_docket_number",
      date: "date", due_date: "due_date", status: "status",
    },
    filters: {
      client: eq("client_id", "bigint"),
      order_number: contains("order_number"),
      ...between("due", "due_date", "date"),
      ...between("created", "date", "date"),
      status: eq("status", "order_status"),
      delivery_docket: eq("delivery_docket_id", "bigint"),
    },
    options: { source: "orders_v", label: "order_number || ' · ' || client_name", orderBy: "(status = 'new') DESC, date DESC, id DESC" },
  },
  order_items: {
    table: "order_items",
    source: "order_items_v",
    select: "*",
    writable: [
      "order_id", "product_id", "part_number", "quantity", "height", "width", "depth", "comment", "has_wire_header",
      "has_header_frame", "type", "number", "clip_type", "clip_position", "has_gasket", "pockets", "has_legs", "wire_mesh",
      "has_gate", "wire_sides", "media_mats", "gasket", "drawing_number", "cut_count", "sow_count", "cut_status", "sow_status",
      "frame_status", "media_status", "wire_status", "package_status", "assemble_status",
    ],
    sorts: {
      client_name: "client_name", order_number: "order_number", order_date: "order_date",
      order_due_date: "order_due_date", order_status: "order_status",
    },
    filters: {
      client: eq("client_id", "bigint"),
      order: eq("order_id", "bigint"),
      order_status: eq("order_status", "order_status"),
      ...between("due", "order_due_date", "date"),
      ...between("created", "order_date", "date"),
      type_code: contains("product_type_code"),
      part_number: contains("part_number"),
      ...between("height", "height", "integer"),
      ...between("width", "width", "integer"),
      ...between("depth", "depth", "integer"),
    },
    options: { source: "order_items_v", label: "part_number", orderBy: "id DESC" },
  },
};
