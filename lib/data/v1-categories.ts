// v1's product categories and their order-item column flags (spec 03), copied once from
// ../fib-om-v2-reference/migrations/: data.sql (the four original names) and
// data-dml-updates.sql (renames, the four added categories, UPDATE … SET show_*).
// seed-dummy creates its categories from this; seed-old (spec 05) uses it for the same mapping.

/** Every show_* column of product_categories, in schema order. */
export const SHOW_COLUMNS = [
  "show_product_type_code",
  "show_product_type_name",
  "show_product_size_name",
  "show_product_media_code",
  "show_quantity",
  "show_height",
  "show_width",
  "show_depth",
  "show_has_wire_header",
  "show_has_header_frame",
  "show_type",
  "show_number",
  "show_clip_type",
  "show_clip_position",
  "show_has_gasket",
  "show_pockets",
  "show_has_legs",
  "show_wire_mesh",
  "show_has_gate",
  "show_calculated_id",
  "show_wire_sides",
  "show_pleats",
  "show_wire_metres",
  "show_wire_height",
  "show_media_mats",
  "show_gasket",
  "show_drawing_number",
  "show_cut_count",
  "show_sow_count",
  "show_cut_status",
  "show_sow_status",
  "show_frame_status",
  "show_media_status",
  "show_wire_status",
  "show_package_status",
  "show_assemble_status",
] as const;

export type ShowColumn = (typeof SHOW_COLUMNS)[number];
export type ShowFlags = Record<ShowColumn, boolean>;
export type V1Category = { name: string; flags: ShowFlags };

/** Legacy (production) category name → v1's name. */
export const V1_CATEGORY_RENAMES: Record<string, string> = {
  Bag: "Bag Filters",
  "Flat Panel": "Flat Panel Filters",
  "Holding Frame": "Holding Frames",
  VForm: "V Form Panel Filters",
};

/** Flags with only the given columns on; v1 leaves every other flag false. */
export function flagsWith(on: readonly ShowColumn[]): ShowFlags {
  return Object.fromEntries(SHOW_COLUMNS.map((c) => [c, on.includes(c)])) as ShowFlags;
}

const DIMENSIONS: ShowColumn[] = ["show_quantity", "show_height", "show_width", "show_depth"];

export const V1_CATEGORIES: V1Category[] = [
  {
    name: "V Form Panel Filters",
    flags: flagsWith([
      ...DIMENSIONS,
      "show_product_media_code",
      "show_calculated_id",
      "show_wire_sides",
      "show_pleats",
      "show_wire_metres",
      "show_wire_height",
      "show_frame_status",
      "show_package_status",
    ]),
  },
  { name: "Flat Panel Filters", flags: flagsWith([...DIMENSIONS, "show_wire_mesh", "show_has_gate"]) },
  {
    name: "Bag Filters",
    flags: flagsWith(["show_product_media_code", ...DIMENSIONS, "show_has_wire_header", "show_has_header_frame"]),
  },
  {
    name: "Holding Frames",
    flags: flagsWith([
      ...DIMENSIONS,
      "show_type",
      "show_number",
      "show_clip_type",
      "show_clip_position",
      "show_has_gasket",
    ]),
  },
  { name: "Wire Products", flags: flagsWith([...DIMENSIONS, "show_pockets", "show_has_legs"]) },
  {
    name: "Carbon Filters",
    flags: flagsWith([
      ...DIMENSIONS,
      "show_product_media_code",
      "show_media_mats",
      "show_gasket",
      "show_frame_status",
      "show_media_status",
    ]),
  },
  { name: "Filter Units", flags: flagsWith(["show_drawing_number"]) },
  { name: "Media", flags: flagsWith(["show_cut_count", "show_sow_count"]) },
];
