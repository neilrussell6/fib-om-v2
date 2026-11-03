import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createFixture, type Fixture, removeFixture } from "../helpers/fixtures";

// Spec 09 T E2: create → list → read → edit → delete for every resource, through the same
// Server Actions and queries the pages use (moved down from e2e crud.spec, which keeps two).
const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string } } }));
vi.mock("@/lib/auth", () => ({
  auth: async () => session.current,
  requireSession: async () => {
    if (!session.current) throw new Error("NEXT_REDIRECT /login");
    return session.current;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let fx: Fixture;
beforeAll(async () => {
  fx = await createFixture();
});
afterAll(() => removeFixture(fx.tag));
beforeEach(() => {
  session.current = { user: { id: "0", email: `${fx.tag}-admin@example.com` } };
});

type Case = {
  key: Parameters<typeof import("@/lib/resources/actions").saveRecord>[0];
  create: () => Record<string, unknown>;
  edit: () => Record<string, unknown>;
  /** List filter that narrows the list to the new record. */
  find: (id: number) => Record<string, string>;
  /** Column and value the edit should leave on the record. */
  check: [string, unknown];
};

const t = () => fx.tag;
const CASES: Case[] = [
  {
    key: "users",
    create: () => ({ email: `${t()}-crud@example.com`, password: "crud-password-123" }),
    edit: () => ({ email: `${t()}-crud2@example.com`, password: "" }),
    find: () => ({ email: `${t()}-crud` }),
    check: ["email", `${"__TAG__"}-crud2@example.com`],
  },
  { key: "clients", create: () => ({ name: `${t()} crud` }), edit: () => ({ name: `${t()} crud2` }), find: () => ({ name: `${t()} crud` }), check: ["name", "__TAG__ crud2"] },
  {
    key: "product_categories",
    create: () => ({ name: `${t()} crud` }),
    edit: () => ({ name: `${t()} crud2` }),
    find: () => ({ name: `${t()} crud` }),
    check: ["name", "__TAG__ crud2"],
  },
  {
    key: "product_types",
    create: () => ({ name: `${t()} crud`, code: "CRUDT" }),
    edit: () => ({ name: `${t()} crud2`, code: "CRUDT" }),
    find: () => ({ name: `${t()} crud` }),
    check: ["name", "__TAG__ crud2"],
  },
  { key: "product_sizes", create: () => ({ name: `${t()} crud` }), edit: () => ({ name: `${t()} crud2` }), find: () => ({ name: `${t()} crud` }), check: ["name", "__TAG__ crud2"] },
  {
    key: "product_media",
    create: () => ({ name: `${t()} crud`, code: "CRUDM" }),
    edit: () => ({ name: `${t()} crud2`, code: "CRUDM" }),
    find: () => ({ name: `${t()} crud` }),
    check: ["name", "__TAG__ crud2"],
  },
  {
    key: "products",
    create: () => ({
      name: `${t()} crud`,
      category_id: String(fx.categoryId),
      type_id: String(fx.typeId),
      size_id: String(fx.sizeId),
      media_id: String(fx.mediaId),
    }),
    edit: () => ({
      name: `${t()} crud2`,
      category_id: String(fx.categoryId),
      type_id: String(fx.typeId),
      size_id: String(fx.sizeId),
      media_id: String(fx.mediaId),
    }),
    find: () => ({ name: `${t()} crud` }),
    check: ["name", "__TAG__ crud2"],
  },
  {
    key: "orders",
    create: () => ({ client_id: String(fx.clientId), order_number: `${t()}-CRUD`, due_date: "2027-01-10", status: "new" }),
    edit: () => ({ client_id: String(fx.clientId), order_number: `${t()}-CRUD2`, due_date: "2027-01-10", status: "new" }),
    find: () => ({ order_number: `${t()}-CRUD` }),
    check: ["order_number", "__TAG__-CRUD2"],
  },
  {
    key: "order_items",
    create: () => ({ order_id: String(fx.orderId), product_id: String(fx.productId), part_number: `${t()}-CRUDPN`, quantity: "3", height: "400", width: "500", depth: "48" }),
    edit: () => ({ order_id: String(fx.orderId), product_id: String(fx.productId), part_number: `${t()}-CRUDPN2`, quantity: "3", height: "400", width: "500", depth: "48" }),
    find: () => ({ part_number: `${t()}-CRUDPN` }),
    check: ["part_number", "__TAG__-CRUDPN2"],
  },
  {
    key: "delivery_dockets",
    create: () => ({ to_client_id: String(fx.otherClientId), status: "current" }),
    edit: () => ({ to_client_id: String(fx.otherClientId), status: "archived" }),
    find: (id) => ({ docket_number: String(id).padStart(6, "0") }),
    check: ["status", "archived"],
  },
];

describe("09 T E2 CRUD lifecycle on every resource", () => {
  it.each(CASES.map((c) => [c.key, c] as const))("%s: create, list, read, edit, delete", async (_k, c) => {
    const { saveRecord, deleteRecord } = await import("@/lib/resources/actions");
    const { listRecords } = await import("@/lib/db/list-query");
    const { getRecord } = await import("@/lib/db/records");
    const { getResource } = await import("@/lib/resources");
    const ui = getResource(c.key);

    const created = await saveRecord(c.key, null, c.create());
    expect(created, JSON.stringify(created)).toMatchObject({ ok: true, message: `${ui.singular} successfully created` });
    if (!created.ok) return;
    const id = created.id;
    expect(created.redirectTo).toBe(ui.afterCreate === "detail" ? `${ui.path}/${id}` : ui.path);

    const listed = await listRecords(c.key, { filters: c.find(id) });
    expect(listed.rows.map((r) => Number(r.id))).toContain(id);
    expect(await getRecord(c.key, id)).not.toBeNull();

    const edited = await saveRecord(c.key, id, c.edit());
    expect(edited, JSON.stringify(edited)).toMatchObject({ ok: true, message: `${ui.singular} successfully updated` });
    const [col, value] = c.check;
    expect((await getRecord(c.key, id))?.[col]).toBe(typeof value === "string" ? value.replace("__TAG__", fx.tag) : value);

    const deleted = await deleteRecord(c.key, id);
    expect(deleted).toEqual({ ok: true, redirectTo: ui.path, message: `${ui.singular} successfully deleted` });
    expect(await getRecord(c.key, id)).toBeNull();
  });
});
