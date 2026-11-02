import { describe, expect, it } from "vitest";

// The spec's tables (lists, forms, categories, order statuses, order-item attributes) as data.
const load = () => import("@/lib/resources");

const cols = (r: { list: { columns: { label: string }[] } }) => r.list.columns.map((c) => c.label);
const filters = (r: { list: { filters: { label: string }[] } }) => r.list.filters.map((f) => f.label);

describe("AC-6 list defaults, filters and columns", () => {
  it.each([
    ["users", { key: "email", dir: "asc" }, ["Name", "Email"], ["Email"]],
    ["clients", { key: "name", dir: "asc" }, ["Name", "Full Name", "Phone", "Shipping Address"], ["Name"]],
    [
      "products",
      { key: "category_name", dir: "asc" },
      ["Category", "Type Name", "Type Code", "Name", "Size", "Media"],
      ["Name", "Type", "Size", "Media", "Category", "Efficiency"],
    ],
    ["product_categories", { key: "name", dir: "asc" }, ["Name"], ["Name"]],
    ["product_types", { key: "code", dir: "asc" }, ["Name", "Code", "MM per Pleat"], ["Name", "Code"]],
    ["product_sizes", { key: "name", dir: "asc" }, ["Name"], ["Name"]],
    ["product_media", { key: "code", dir: "asc" }, ["Name", "Code", "Pleat Spacing"], ["Name", "Code"]],
    [
      "orders",
      { key: "date", dir: "desc" },
      ["Client", "Order Number", "Delivery Docket", "Created", "Due", "Status"],
      // Spec 07 AC-2: the Status filter is replaced by tabs.
      ["Client", "Order Number", "Due From", "Due To", "Created From", "Created To", "Delivery Docket"],
    ],
    [
      "order_items",
      { key: "order_due_date", dir: "desc" },
      // Spec 06 AC-12 / AC-14: the design's columns; the Order Status filter is replaced by tabs.
      ["Client", "Order", "Product", "Size", "Qty", "Due", "Status"],
      [
        "Client", "Order", "Due From", "Due To", "Created From", "Created To", "Type Code",
        "Part Number", "Height From", "Height To", "Width From", "Width To", "Depth From", "Depth To",
      ],
    ],
    [
      "delivery_dockets",
      { key: "date", dir: "desc" },
      ["To Client", "Docket Number", "Date", "Status"],
      ["To Client", "Docket Number", "Created From", "Created To"], // spec 07 AC-2
    ],
  ] as const)("%s", async (key, sort, columns, filterLabels) => {
    const { RESOURCES } = await load();
    const r = RESOURCES[key];
    expect(r.list.defaultSort).toEqual(sort);
    expect(cols(r)).toEqual(columns);
    expect(filters(r)).toEqual(filterLabels);
  });

  it("orders and dockets have no status filter (spec 07 AC-2)", async () => {
    const { RESOURCES } = await load();
    expect(RESOURCES.delivery_dockets.list.filters.find((f) => f.key === "status")).toBeUndefined();
    expect(RESOURCES.orders.list.filters.find((f) => f.key === "status")).toBeUndefined();
  });
});

describe("Navigation and headings", () => {
  it("every resource is enabled in the sidebar, in the design's grouped order (spec 06)", async () => {
    const { NAV_ITEMS } = await import("@/components/app-shell/nav-items");
    expect(NAV_ITEMS.map((i) => i.label)).toEqual([
      "Dashboard", "Orders", "Order Items", "Delivery Dockets", "Products", "Product Categories",
      "Product Types", "Product Sizes", "Product Media", "Clients", "Users",
    ]);
  });

  it("resources have singular and plural names for headings", async () => {
    const { RESOURCES } = await load();
    expect([RESOURCES.product_media.singular, RESOURCES.product_media.plural]).toEqual(["Product Media", "Product Media"]);
    expect([RESOURCES.delivery_dockets.singular, RESOURCES.delivery_dockets.plural]).toEqual(["Delivery Docket", "Delivery Dockets"]);
    expect([RESOURCES.order_items.singular, RESOURCES.order_items.plural]).toEqual(["Order Item", "Order Items"]);
  });
});

describe("AC-24 product category flags", () => {
  it("has every show_* flag as a switch, grouped under the heading in the v1 groups", async () => {
    const { RESOURCES } = await load();
    const fields = RESOURCES.product_categories.fields.filter((f) => f.name.startsWith("show_"));
    expect(fields).toHaveLength(36); // v1 data-ddl-updates.sql adds 36 show_* columns
    expect(fields.every((f) => f.type === "boolean")).toBe(true);
    expect(RESOURCES.product_categories.formHeading).toBe("Columns to show on Order Items page (for this category)");
    const groups = [...new Set(fields.map((f) => f.group))];
    expect(groups).toEqual([
      "Product type", "Product size", "Product media", "Dimensions", "Bag filters", "Holding frames",
      "Wire products", "Flat panel filters", "V form panel filters", "Carbon filters", "Filter units", "Media", "Statuses",
    ]);
  });
});

describe("AC-25 client fields", () => {
  it("has every client field, with label use part number as a switch", async () => {
    const { RESOURCES } = await load();
    const f = RESOURCES.clients.fields;
    expect(f.map((x) => x.label)).toEqual([
      "Name", "Full Name", "Phone", "Shipping Address", "Billing Address", "ABN", "ACN", "Fax", "Landline",
      "Label Reorder Text", "Label Name", "Label Sub-name", "Label Address Line 1", "Label Address Line 2",
      "Label Use Part Number",
    ]);
    expect(f.find((x) => x.name === "label_use_part_number")?.type).toBe("boolean");
  });
});

describe("AC-26 / AC-27 choices", () => {
  it("order status choices are exactly New, Complete, Archived", async () => {
    const { RESOURCES } = await load();
    const status = RESOURCES.orders.fields.find((f) => f.name === "status")!;
    expect(status.options?.map((o) => o.label)).toEqual(["New", "Complete", "Archived"]);
  });

  it.each([
    ["clip_type", ["Pocket", "Bag", "HEPA", "Gate", "Ring"]],
    ["clip_position", ["Bevel", "Ludwig", "Clamp"]],
    ["wire_mesh", ["0", "1", "2"]],
    ["wire_sides", ["1", "2"]],
    ["media_mats", ["1", "2"]],
    ["gasket", ["1", "2"]],
  ])("order item %s choices", async (name, labels) => {
    const { RESOURCES } = await load();
    const f = RESOURCES.order_items.fields.find((x) => x.name === name)!;
    expect(f.type).toBe("select");
    expect(f.options?.map((o) => o.label)).toEqual(labels);
  });

  it("order item attribute types", async () => {
    const { RESOURCES } = await load();
    const type = (n: string) => RESOURCES.order_items.fields.find((x) => x.name === n)?.type;
    for (const n of ["has_wire_header", "has_header_frame", "has_gasket", "has_legs", "has_gate"]) expect(type(n), n).toBe("boolean");
    expect(type("type")).toBe("text");
    for (const n of ["number", "pockets", "drawing_number", "cut_count", "sow_count"]) expect(type(n), n).toBe("number");
    for (const n of ["cut_status", "sow_status", "frame_status", "media_status", "wire_status", "package_status", "assemble_status"]) {
      expect(type(n), n).toBe("boolean");
    }
  });

  it("delivery docket form has to-client and status only", async () => {
    const { RESOURCES } = await load();
    expect(RESOURCES.delivery_dockets.fields.filter((f) => f.form !== false).map((f) => f.name)).toEqual(["to_client_id", "status"]);
  });
});

describe("06 AC-8 list titles and New buttons", () => {
  it.each([
    ["users", "Users", "New user"],
    ["clients", "Clients", "New client"],
    ["product_categories", "Product categories", "New product category"],
    ["product_types", "Product types", "New product type"],
    ["product_sizes", "Product sizes", "New product size"],
    ["product_media", "Product media", "New product media"],
    ["products", "Products", "New product"],
    ["orders", "Orders", "New order"],
    ["order_items", "Order items", "New item"],
    ["delivery_dockets", "Delivery dockets", "New delivery docket"],
  ] as const)("%s → %s / %s", async (key, title, newLabel) => {
    const { RESOURCES, resourceTitle, resourceNewLabel } = await load();
    expect(resourceTitle(RESOURCES[key])).toBe(title);
    expect(resourceNewLabel(RESOURCES[key])).toBe(newLabel);
  });
});

describe("06 AC-13 / 07 AC-2 status tabs", () => {
  it("order items, orders and delivery dockets declare statusTabs with their own column and options", async () => {
    const { RESOURCES, ORDER_STATUS, DOCKET_STATUS } = await load();
    const withTabs = Object.values(RESOURCES).filter((r) => r.list.statusTabs).map((r) => r.key).sort();
    expect(withTabs).toEqual(["delivery_dockets", "order_items", "orders"]);
    expect(RESOURCES.order_items.list.statusTabs).toEqual({ key: "order_status", options: ORDER_STATUS });
    expect(RESOURCES.orders.list.statusTabs).toEqual({ key: "status", options: ORDER_STATUS });
    expect(RESOURCES.delivery_dockets.list.statusTabs).toEqual({ key: "status", options: DOCKET_STATUS });
  });
});

describe("07 title fields and chips", () => {
  it.each([
    ["orders", "order_number"],
    ["delivery_dockets", "docket_number"],
    ["order_items", "order_number"],
    ["users", "name"],
    ["clients", "name"],
    ["products", "name"],
    ["product_categories", "name"],
    ["product_types", "name"],
    ["product_sizes", "name"],
    ["product_media", "name"],
  ] as const)("%s titleField is %s and is one of its list columns", async (key, field) => {
    const { RESOURCES } = await load();
    expect(RESOURCES[key].titleField).toBe(field);
    expect(RESOURCES[key].list.columns.map((c) => c.key)).toContain(field);
  });

  it("recordTitle uses the title field, falling back to the email when blank", async () => {
    const { RESOURCES, recordTitle } = await load();
    expect(recordTitle(RESOURCES.products, { name: "Bag", category_name: "Cat" })).toBe("Bag");
    expect(recordTitle(RESOURCES.users, { name: "Ann", email: "a@x.io" })).toBe("Ann");
    expect(recordTitle(RESOURCES.users, { name: "  ", email: "a@x.io" })).toBe("a@x.io");
    expect(recordTitle(RESOURCES.users, { name: null, email: "a@x.io" })).toBe("a@x.io");
  });

  it("only the order and docket status fields render as chips", async () => {
    const { RESOURCES } = await load();
    const chips = Object.values(RESOURCES).flatMap((r) => r.fields.filter((f) => f.chips).map((f) => `${r.key}.${f.name}`));
    expect(chips.sort()).toEqual(["delivery_dockets.status", "orders.status"]);
  });
});

describe("06 AC-12 order item columns", () => {
  it("links the client, right-aligns quantity, and sorts by due date descending", async () => {
    const { RESOURCES } = await load();
    const c = RESOURCES.order_items.list.columns;
    expect(c.map((x) => x.key)).toEqual([
      "client_name", "order_number", "product_name", "product_size_name", "quantity", "order_due_date", "order_status",
    ]);
    expect(c[0].link).toEqual({ path: "/clients", idKey: "client_id" });
    expect(c.find((x) => x.key === "quantity")?.align).toBe("right");
    expect(RESOURCES.order_items.list.filters.filter((f) => f.alwaysShown).map((f) => f.key)).toEqual(["client", "order"]);
  });
});

describe("06 AC-10 users name", () => {
  it("has an optional Name field first on the form", async () => {
    const { RESOURCES } = await load();
    const [first] = RESOURCES.users.fields;
    expect(first).toMatchObject({ name: "name", label: "Name", type: "text" });
    expect(first.required).toBeFalsy();
  });
});

describe("08 AC-1 / AC-2 create dialog text", () => {
  it.each([
    ["order_items", "Add a product line to an existing order.", "Add item"],
    ["orders", "Start a new order for a client.", "Add order"],
    ["delivery_dockets", "Start a docket for delivering orders to a client.", "Add delivery docket"],
    ["products", "Add a product to the catalogue.", "Add product"],
    ["product_categories", "Choose which columns Order Items shows for this category.", "Add product category"],
    ["product_types", "Add a product type with its code.", "Add product type"],
    ["product_sizes", "Add a size that products are made in.", "Add product size"],
    ["product_media", "Add a filter media with its code.", "Add product media"],
    ["clients", "Add a customer you take orders for.", "Add client"],
    ["users", "Give someone access to Fibatron.", "Add user"],
  ] as const)("%s: description and add label", async (key, description, addLabel) => {
    const { RESOURCES, resourceAddLabel } = await load();
    expect(RESOURCES[key].createDescription).toBe(description);
    expect(resourceAddLabel(RESOURCES[key])).toBe(addLabel);
  });

  it("the dialog title is New <singular in lower case>", async () => {
    const { RESOURCES, resourceCreateTitle } = await load();
    expect(resourceCreateTitle(RESOURCES.order_items)).toBe("New order item");
    expect(resourceCreateTitle(RESOURCES.product_categories)).toBe("New product category");
  });
});
