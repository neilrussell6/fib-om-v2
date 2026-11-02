import type { FieldDef, FilterDef, Option, ResourceKey, ResourceUi } from "./types";

export * from "./types";

export const ORDER_STATUS: Option[] = [
  { value: "new", label: "New" },
  { value: "complete", label: "Complete" },
  { value: "archived", label: "Archived" },
];

export const DOCKET_STATUS: Option[] = [
  { value: "current", label: "Current" },
  { value: "archived", label: "Archived" },
];

const opts = (pairs: [string, string][]): Option[] => pairs.map(([value, label]) => ({ value, label }));
const ONE_OR_TWO = opts([["1", "1"], ["2", "2"]]);

const text = (name: string, label: string, extra: Partial<FieldDef> = {}): FieldDef => ({ name, label, type: "text", ...extra });
const num = (name: string, label: string, extra: Partial<FieldDef> = {}): FieldDef => ({ name, label, type: "number", ...extra });
const bool = (name: string, label: string, extra: Partial<FieldDef> = {}): FieldDef => ({ name, label, type: "boolean", ...extra });
const textFilter = (key: string, label: string, alwaysShown = true): FilterDef => ({ key, label, kind: "text", alwaysShown });
const range = (key: string, label: string, kind: "date" | "number"): FilterDef[] => [
  { key: `${key}_from`, label: `${label} From`, kind },
  { key: `${key}_to`, label: `${label} To`, kind },
];

/** Product category flags, in v1's groups (packages/web3/.../productCategories.jsx). */
const CATEGORY_FLAGS: [group: string, flags: [name: string, label: string][]][] = [
  ["Product type", [["show_product_type_code", "Product Type Code"], ["show_product_type_name", "Product Type Name"]]],
  ["Product size", [["show_product_size_name", "Product Size Name"]]],
  ["Product media", [["show_product_media_code", "Product Media Code"]]],
  ["Dimensions", [["show_quantity", "Quantity"], ["show_height", "Height"], ["show_width", "Width"], ["show_depth", "Depth"]]],
  ["Bag filters", [["show_has_wire_header", "Has Wire Header?"], ["show_has_header_frame", "Has Header Frame?"]]],
  [
    "Holding frames",
    [["show_type", "Type"], ["show_number", "Number"], ["show_clip_type", "Clip Type"], ["show_clip_position", "Clip Position"], ["show_has_gasket", "Has Gasket?"]],
  ],
  ["Wire products", [["show_pockets", "Pockets"], ["show_has_legs", "Has Legs?"]]],
  ["Flat panel filters", [["show_wire_mesh", "Wire Mesh"], ["show_has_gate", "Has Gate?"]]],
  [
    "V form panel filters",
    [["show_calculated_id", "ID"], ["show_wire_sides", "Wire Sides"], ["show_pleats", "Pleats"], ["show_wire_metres", "Wire Metres"], ["show_wire_height", "Wire Height"]],
  ],
  ["Carbon filters", [["show_media_mats", "Media Mats"], ["show_gasket", "Gasket"]]],
  ["Filter units", [["show_drawing_number", "Drawing Number"]]],
  ["Media", [["show_cut_count", "Cut Count"], ["show_sow_count", "Sow Count"]]],
  [
    "Statuses",
    [
      ["show_cut_status", "Cut Status"], ["show_sow_status", "Sow Status"], ["show_frame_status", "Frame Status"],
      ["show_media_status", "Media Status"], ["show_wire_status", "Wire Status"], ["show_package_status", "Package Status"],
      ["show_assemble_status", "Assemble Status"],
    ],
  ],
];

export const STAGES: [name: string, label: string][] = [
  ["cut_status", "Cut Status"], ["sow_status", "Sow Status"], ["frame_status", "Frame Status"], ["media_status", "Media Status"],
  ["wire_status", "Wire Status"], ["package_status", "Package Status"], ["assemble_status", "Assemble Status"],
];

export const RESOURCES: Record<ResourceKey, ResourceUi> = {
  users: {
    key: "users", path: "/users", singular: "User", plural: "Users",
    titleField: "name",
    fields: [
      text("name", "Name"),
      { name: "email", label: "Email", type: "email", required: true },
      { name: "password", label: "Password", type: "password", detail: false },
    ],
    list: { columns: [{ key: "name", label: "Name" }, { key: "email", label: "Email" }], defaultSort: { key: "email", dir: "asc" }, filters: [textFilter("email", "Email")] },
  },

  clients: {
    key: "clients", path: "/clients", singular: "Client", plural: "Clients",
    titleField: "name",
    fields: [
      text("name", "Name", { required: true }), text("full_name", "Full Name"), text("phone", "Phone"),
      text("address_shipping", "Shipping Address"), text("address_billing", "Billing Address"), text("abn", "ABN"),
      text("acn", "ACN"), text("fax", "Fax"), text("landline", "Landline"), text("label_reorder_text", "Label Reorder Text"),
      text("label_name", "Label Name"), text("label_sub_name", "Label Sub-name"), text("label_address_line1", "Label Address Line 1"),
      text("label_address_line2", "Label Address Line 2"), bool("label_use_part_number", "Label Use Part Number"),
    ],
    list: {
      columns: [
        { key: "name", label: "Name" }, { key: "full_name", label: "Full Name" }, { key: "phone", label: "Phone" },
        { key: "address_shipping", label: "Shipping Address" },
      ],
      defaultSort: { key: "name", dir: "asc" },
      filters: [textFilter("name", "Name")],
    },
  },

  product_categories: {
    key: "product_categories", path: "/product-categories", singular: "Product Category", plural: "Product Categories",
    titleField: "name",
    formHeading: "Columns to show on Order Items page (for this category)",
    fields: [
      text("name", "Name", { required: true }),
      ...CATEGORY_FLAGS.flatMap(([group, flags]) => flags.map(([name, label]) => bool(name, label, { group }))),
    ],
    list: { columns: [{ key: "name", label: "Name" }], defaultSort: { key: "name", dir: "asc" }, filters: [textFilter("name", "Name")] },
  },

  product_types: {
    key: "product_types", path: "/product-types", singular: "Product Type", plural: "Product Types",
    titleField: "name",
    fields: [text("name", "Name", { required: true }), text("code", "Code", { required: true }), num("millimetres_per_pleat", "MM per Pleat")],
    list: {
      columns: [{ key: "name", label: "Name" }, { key: "code", label: "Code" }, { key: "millimetres_per_pleat", label: "MM per Pleat" }],
      defaultSort: { key: "code", dir: "asc" },
      filters: [textFilter("name", "Name"), textFilter("code", "Code")],
    },
  },

  product_sizes: {
    key: "product_sizes", path: "/product-sizes", singular: "Product Size", plural: "Product Sizes",
    titleField: "name",
    fields: [text("name", "Name", { required: true })],
    list: { columns: [{ key: "name", label: "Name" }], defaultSort: { key: "name", dir: "asc" }, filters: [textFilter("name", "Name")] },
  },

  product_media: {
    key: "product_media", path: "/product-media", singular: "Product Media", plural: "Product Media",
    titleField: "name",
    fields: [text("name", "Name", { required: true }), text("code", "Code", { required: true }), num("pleat_spacing", "Pleat Spacing")],
    list: {
      columns: [{ key: "name", label: "Name" }, { key: "code", label: "Code" }, { key: "pleat_spacing", label: "Pleat Spacing" }],
      defaultSort: { key: "code", dir: "asc" },
      filters: [textFilter("name", "Name"), textFilter("code", "Code")],
    },
  },

  products: {
    key: "products", path: "/products", singular: "Product", plural: "Products",
    titleField: "name",
    fields: [
      text("name", "Name", { required: true }),
      { name: "category_id", label: "Category", type: "reference", ref: "product_categories", required: true, display: "category_name" },
      { name: "type_id", label: "Type", type: "reference", ref: "product_types", required: true, display: "type_name" },
      { name: "size_id", label: "Size", type: "reference", ref: "product_sizes", required: true, display: "size_name" },
      { name: "media_id", label: "Media", type: "reference", ref: "product_media", required: true, display: "media_name" },
      bool("notcher", "Notcher"),
      text("efficiency", "Efficiency"),
    ],
    list: {
      columns: [
        { key: "category_name", label: "Category" }, { key: "type_name", label: "Type Name" }, { key: "type_code", label: "Type Code" },
        { key: "name", label: "Name" }, { key: "size_name", label: "Size" }, { key: "media_name", label: "Media" },
      ],
      defaultSort: { key: "category_name", dir: "asc" },
      filters: [
        textFilter("name", "Name"),
        { key: "type", label: "Type", kind: "reference", ref: "product_types" },
        textFilter("size", "Size", false),
        textFilter("media", "Media", false),
        { key: "category", label: "Category", kind: "reference", ref: "product_categories" },
        textFilter("efficiency", "Efficiency", false),
      ],
    },
  },

  delivery_dockets: {
    key: "delivery_dockets", path: "/delivery-dockets", singular: "Delivery Docket", plural: "Delivery Dockets",
    titleField: "docket_number",
    afterCreate: "detail",
    fields: [
      { name: "to_client_id", label: "To Client", type: "reference", ref: "clients", required: true, display: "to_client_name" },
      { name: "status", label: "Status", type: "select", options: DOCKET_STATUS, required: true, default: "current", chips: true },
      text("docket_number", "Docket Number", { form: false }),
      { name: "date", label: "Date", type: "date", form: false },
      { name: "from_client_id", label: "From Client", type: "reference", ref: "clients", form: false, display: "from_client_name" },
    ],
    list: {
      columns: [
        { key: "to_client_name", label: "To Client" }, { key: "docket_number", label: "Docket Number" },
        { key: "date", label: "Date", format: "date" }, { key: "status", label: "Status", format: "enum", options: DOCKET_STATUS },
      ],
      defaultSort: { key: "date", dir: "desc" },
      filters: [
        textFilter("to_client", "To Client"),
        textFilter("docket_number", "Docket Number", false),
        ...range("created", "Created", "date"),
      ],
      // Spec 07: tabs replace the Status filter.
      statusTabs: { key: "status", options: DOCKET_STATUS },
    },
  },

  orders: {
    key: "orders", path: "/orders", singular: "Order", plural: "Orders",
    titleField: "order_number",
    fields: [
      { name: "client_id", label: "Client", type: "reference", ref: "clients", required: true, display: "client_name" },
      text("order_number", "Order Number", { required: true }),
      { name: "date", label: "Created", type: "date", form: false },
      { name: "due_date", label: "Due Date", type: "date", required: true },
      { name: "status", label: "Status", type: "select", options: ORDER_STATUS, required: true, default: "new", chips: true },
      {
        name: "delivery_docket_id", label: "Delivery Docket", type: "reference", ref: "delivery_dockets",
        refFilter: { param: "clientId", from: "client_id" }, display: "delivery_docket_number",
      },
    ],
    list: {
      columns: [
        { key: "client_name", label: "Client", link: { path: "/clients", idKey: "client_id" } },
        { key: "order_number", label: "Order Number" },
        { key: "delivery_docket_number", label: "Delivery Docket" },
        { key: "date", label: "Created", format: "date" },
        { key: "due_date", label: "Due", format: "date" },
        { key: "status", label: "Status", format: "enum", options: ORDER_STATUS },
      ],
      defaultSort: { key: "date", dir: "desc" },
      filters: [
        { key: "client", label: "Client", kind: "reference", ref: "clients", alwaysShown: true },
        textFilter("order_number", "Order Number"),
        ...range("due", "Due", "date"),
        ...range("created", "Created", "date"),
        { key: "delivery_docket", label: "Delivery Docket", kind: "reference", ref: "delivery_dockets" },
      ],
      // Spec 07: tabs replace the Status filter.
      statusTabs: { key: "status", options: ORDER_STATUS },
    },
  },

  order_items: {
    key: "order_items", path: "/order-items", singular: "Order Item", plural: "Order Items", newLabel: "New item",
    titleField: "order_number",
    fields: [
      { name: "order_id", label: "Order", type: "reference", ref: "orders", required: true, display: "order_number" },
      { name: "product_id", label: "Product", type: "reference", ref: "products", required: true, display: "product_name" },
      text("product_type_code", "Type Code", { form: false }),
      text("product_type_name", "Description", { form: false }),
      text("part_number", "Part Number", { required: true }),
      num("quantity", "Quantity", { required: true }),
      num("height", "Height", { required: true }),
      num("width", "Width", { required: true }),
      num("depth", "Depth", { required: true }),
      { name: "comment", label: "Comment", type: "textarea" },
      bool("has_wire_header", "Has Wire Header?", { group: "Attributes" }),
      bool("has_header_frame", "Has Header Frame?", { group: "Attributes" }),
      text("type", "Type", { group: "Attributes" }),
      num("number", "Number", { group: "Attributes" }),
      { name: "clip_type", label: "Clip Type", type: "select", group: "Attributes", options: opts([["pocket", "Pocket"], ["bag", "Bag"], ["hepa", "HEPA"], ["gate", "Gate"], ["ring", "Ring"]]) },
      { name: "clip_position", label: "Clip Position", type: "select", group: "Attributes", options: opts([["bevel", "Bevel"], ["ludwig", "Ludwig"], ["clamp", "Clamp"]]) },
      bool("has_gasket", "Has Gasket?", { group: "Attributes" }),
      num("pockets", "Pockets", { group: "Attributes" }),
      bool("has_legs", "Has Legs?", { group: "Attributes" }),
      { name: "wire_mesh", label: "Wire Mesh", type: "select", group: "Attributes", options: opts([["0", "0"], ["1", "1"], ["2", "2"]]) },
      bool("has_gate", "Has Gate?", { group: "Attributes" }),
      { name: "wire_sides", label: "Wire Sides", type: "select", group: "Attributes", options: ONE_OR_TWO },
      { name: "media_mats", label: "Media Mats", type: "select", group: "Attributes", options: ONE_OR_TWO },
      { name: "gasket", label: "Gasket", type: "select", group: "Attributes", options: ONE_OR_TWO },
      num("drawing_number", "Drawing Number", { group: "Attributes" }),
      num("cut_count", "Cut Count", { group: "Attributes" }),
      num("sow_count", "Sow Count", { group: "Attributes" }),
      { name: "order_status", label: "Order Status", type: "select", options: ORDER_STATUS, form: false },
      ...STAGES.map(([name, label]) => bool(name, label, { group: "Stages" })),
    ],
    list: {
      // Spec 06: the design's columns; status is the order's, shown as tabs above the list.
      columns: [
        { key: "client_name", label: "Client", link: { path: "/clients", idKey: "client_id" } },
        { key: "order_number", label: "Order" },
        { key: "product_name", label: "Product" },
        { key: "product_size_name", label: "Size" },
        { key: "quantity", label: "Qty", align: "right" },
        { key: "order_due_date", label: "Due", format: "date" },
        { key: "order_status", label: "Status", format: "enum", options: ORDER_STATUS },
      ],
      defaultSort: { key: "order_due_date", dir: "desc" },
      statusTabs: { key: "order_status", options: ORDER_STATUS },
      filters: [
        { key: "client", label: "Client", kind: "reference", ref: "clients", alwaysShown: true },
        { key: "order", label: "Order", kind: "reference", ref: "orders", alwaysShown: true },
        ...range("due", "Due", "date"),
        ...range("created", "Created", "date"),
        textFilter("type_code", "Type Code", false),
        textFilter("part_number", "Part Number", false),
        ...range("height", "Height", "number"),
        ...range("width", "Width", "number"),
        ...range("depth", "Depth", "number"),
      ],
    },
  },
};

export function getResource(key: string): ResourceUi {
  const r = (RESOURCES as Record<string, ResourceUi | undefined>)[key];
  if (!r) throw new Error(`Unknown resource: ${key}`);
  return r;
}

/** Fields shown on the create/edit form. */
export const formFields = (r: ResourceUi) => r.fields.filter((f) => f.form !== false);

/** List heading: the resource's title, or its plural in sentence case (spec 06). */
export const resourceTitle = (r: ResourceUi) => r.title ?? r.plural.charAt(0) + r.plural.slice(1).toLowerCase();

/** The list's create button label (spec 06). */
export const resourceNewLabel = (r: ResourceUi) => r.newLabel ?? `New ${r.singular.toLowerCase()}`;

/** The singular in sentence case, e.g. "Product category" (spec 07 panel caption and not-found toast). */
export const singularLabel = (r: ResourceUi) => r.singular.charAt(0) + r.singular.slice(1).toLowerCase();

/** The record's title for the panel heading and the title cell: its title field, or its email when blank (spec 07). */
export function recordTitle(r: ResourceUi, row: Record<string, unknown>): string {
  const v = row[r.titleField];
  const text = v === null || v === undefined ? "" : String(v).trim();
  if (text) return text;
  return typeof row.email === "string" ? row.email : "";
}
