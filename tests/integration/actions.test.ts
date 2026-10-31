import bcrypt from "bcryptjs";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createFixture, type Fixture, removeFixture, SENDER_CLIENT_ID } from "../helpers/fixtures";
import { getUser, withDb } from "../helpers/test-db";

// Server Actions are imported directly, with the session and Next's cache mocked.
const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string } } }));
vi.mock("@/lib/auth", () => ({
  auth: async () => session.current,
  requireSession: async () => {
    if (!session.current) throw new Error("NEXT_REDIRECT /login");
    return session.current;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const actions = () => import("@/lib/resources/actions");

let fx: Fixture;
let adminId: number;
beforeAll(async () => {
  fx = await createFixture();
  adminId = await withDb(async (c) =>
    Number((await c.query("INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id", [`${fx.tag}-admin@example.com`])).rows[0].id),
  );
});
afterAll(() => removeFixture(fx.tag));
beforeEach(() => {
  session.current = { user: { id: String(adminId), email: `${fx.tag}-admin@example.com` } };
});

const ALL_KEYS = [
  "users", "clients", "product_categories", "product_types", "product_sizes", "product_media",
  "products", "orders", "order_items", "delivery_dockets",
] as const;

describe("AC-21 every Server Action needs a session", () => {
  it.each(ALL_KEYS)("%s: save and delete are refused without a session, writing nothing", async (key) => {
    session.current = null;
    const { saveRecord, deleteRecord } = await actions();
    await expect(saveRecord(key, null, { name: `${fx.tag} nope` })).rejects.toThrow();
    await expect(deleteRecord(key, fx.clientId)).rejects.toThrow();
    const n = await withDb(async (c) => (await c.query("SELECT count(*)::int AS n FROM clients WHERE id = $1", [fx.clientId])).rows[0].n);
    expect(n).toBe(1);
  });
});

describe("AC-15 server-side validation", () => {
  it("invalid data returns field errors and writes nothing", async () => {
    const { saveRecord } = await actions();
    const r = await saveRecord("product_types", null, { name: "", code: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.fieldErrors ?? {})).toEqual(expect.arrayContaining(["name", "code"]));
  });

  it("rejects an unknown resource", async () => {
    const { saveRecord } = await actions();
    await expect(saveRecord("pg_shadow" as never, null, {})).rejects.toThrow(/unknown resource/i);
  });
});

describe("AC-31 a client with only a name", () => {
  it("saves with every empty optional field as NULL", async () => {
    const { saveRecord } = await actions();
    const r = await saveRecord("clients", null, { name: `${fx.tag} Only Name`, full_name: "", phone: "" });
    expect(r.ok).toBe(true);
    const row = await withDb(async (c) => (await c.query("SELECT full_name, phone, abn FROM clients WHERE name = $1", [`${fx.tag} Only Name`])).rows[0]);
    expect(row).toEqual({ full_name: null, phone: null, abn: null });
  });
});

describe("Save results", () => {
  it("create redirects to the list with the success message", async () => {
    const { saveRecord } = await actions();
    const r = await saveRecord("product_sizes", null, { name: `${fx.tag} New Size` });
    expect(r).toMatchObject({ ok: true, redirectTo: "/product-sizes", message: "Product Size successfully created" });
  });

  it("update redirects to the list with the success message", async () => {
    const { saveRecord } = await actions();
    const r = await saveRecord("product_sizes", fx.sizeId, { name: `${fx.tag} Renamed` });
    expect(r).toMatchObject({ ok: true, redirectTo: "/product-sizes", message: "Product Size successfully updated" });
  });

  it("AC-18 deleting a client that has orders fails with the friendly message", async () => {
    const { deleteRecord } = await actions();
    // A client with an order and nothing else, so the orders constraint is the one hit.
    const clientId = await withDb(async (c) => {
      const id = Number((await c.query("INSERT INTO clients (name) VALUES ($1) RETURNING id", [`${fx.tag} Has Orders`])).rows[0].id);
      await c.query("INSERT INTO orders (client_id, order_number, due_date) VALUES ($1, $2, '2026-12-01')", [id, `${fx.tag}-HO`]);
      return id;
    });
    const r = await deleteRecord("clients", clientId);
    expect(r).toEqual({ ok: false, error: "cannot delete clients that still have orders" });
  });

  it("delete succeeds and reports the message", async () => {
    const { saveRecord, deleteRecord } = await actions();
    const created = await saveRecord("product_sizes", null, { name: `${fx.tag} Doomed` });
    if (!created.ok) throw new Error("setup");
    expect(await deleteRecord("product_sizes", created.id)).toMatchObject({
      ok: true, redirectTo: "/product-sizes", message: "Product Size successfully deleted",
    });
  });
});

describe("AC-22 users", () => {
  const email = () => `${fx.tag}-user@example.com`;

  it("stores a bcrypt hash and never returns it", async () => {
    const { saveRecord } = await actions();
    const r = await saveRecord("users", null, { email: email(), password: "first-password-1" });
    expect(r.ok).toBe(true);
    expect(JSON.stringify(r)).not.toMatch(/\$2[aby]\$|first-password-1/);
    const u = await getUser(email());
    expect(await bcrypt.compare("first-password-1", u!.password_hash)).toBe(true);
  });

  it("a blank password on edit keeps the current one; a new one replaces it", async () => {
    const { saveRecord } = await actions();
    const u = await getUser(email());
    await saveRecord("users", u!.id, { email: email(), password: "" });
    expect((await getUser(email()))!.password_hash).toBe(u!.password_hash);
    await saveRecord("users", u!.id, { email: email(), password: "second-password-2" });
    expect(await bcrypt.compare("second-password-2", (await getUser(email()))!.password_hash)).toBe(true);
  });

  it("a duplicate email shows 'email already in use'", async () => {
    const { saveRecord } = await actions();
    const r = await saveRecord("users", null, { email: email(), password: "another-password" });
    expect(r).toEqual({ ok: false, error: "email already in use" });
  });

  it("AC-34 you can't delete your own account", async () => {
    const { deleteRecord } = await actions();
    expect(await deleteRecord("users", adminId)).toEqual({ ok: false, error: "You can't delete your own account" });
  });
});

describe("AC-34 the last user can't be deleted", () => {
  it("refuses when the target is the only user (inside a rolled-back transaction)", async () => {
    const { deleteUserChecked } = await import("@/lib/db/queries/users");
    const { tx } = await import("@/lib/db");
    class Rollback extends Error {}
    let result: unknown;
    await expect(
      tx(async (client) => {
        await client.query("DELETE FROM users WHERE id <> $1", [adminId]);
        result = await deleteUserChecked(client, adminId, -1);
        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
    expect(result).toEqual({ ok: false, error: "Can't delete the last user" });
    expect(await getUser(`${fx.tag}-admin@example.com`)).toBeDefined();
  });
});

describe("AC-32 an order's docket must belong to its client", () => {
  it("refuses another client's docket", async () => {
    const { saveRecord } = await actions();
    const r = await saveRecord("orders", fx.orderId, {
      client_id: fx.clientId, order_number: fx.names.orderNumber, due_date: "2026-12-01", status: "new", delivery_docket_id: fx.otherDocketId,
    });
    expect(r).toEqual({ ok: false, error: "delivery docket belongs to another client" });
  });

  it("accepts the client's own docket", async () => {
    const { saveRecord } = await actions();
    const r = await saveRecord("orders", fx.orderId, {
      client_id: fx.clientId, order_number: fx.names.orderNumber, due_date: "2026-12-01", status: "new", delivery_docket_id: fx.docketId,
    });
    expect(r.ok).toBe(true);
  });
});

describe("AC-28 / AC-33 docket creation and FROM_CLIENT_ID", () => {
  const original = process.env.FROM_CLIENT_ID;
  afterEach(() => {
    process.env.FROM_CLIENT_ID = original;
  });
  const count = () => withDb(async (c) => (await c.query("SELECT count(*)::int AS n FROM delivery_dockets WHERE to_client_id = $1", [fx.otherClientId])).rows[0].n);

  it("sets from_client_id from FROM_CLIENT_ID, defaults to current, and redirects to the detail page", async () => {
    process.env.FROM_CLIENT_ID = String(SENDER_CLIENT_ID);
    const { saveRecord } = await actions();
    const r = await saveRecord("delivery_dockets", null, { to_client_id: fx.otherClientId, from_client_id: fx.clientId });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.redirectTo).toBe(`/delivery-dockets/${r.id}`);
    const row = await withDb(async (c) => (await c.query("SELECT from_client_id, status FROM delivery_dockets WHERE id = $1", [r.id])).rows[0]);
    expect(row).toEqual({ from_client_id: String(SENDER_CLIENT_ID), status: "current" });
  });

  it.each([
    ["unset", undefined],
    ["pointing at no client", "987654321"],
  ])("with FROM_CLIENT_ID %s, create fails and writes nothing", async (_label, value) => {
    if (value === undefined) delete process.env.FROM_CLIENT_ID;
    else process.env.FROM_CLIENT_ID = value;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const before = await count();
    const { saveRecord } = await actions();
    const r = await saveRecord("delivery_dockets", null, { to_client_id: fx.otherClientId });
    expect(r).toEqual({ ok: false, error: "sender client is not configured" });
    expect(await count()).toBe(before);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("edit changes to-client and status only", async () => {
    process.env.FROM_CLIENT_ID = String(SENDER_CLIENT_ID);
    const { saveRecord } = await actions();
    const r = await saveRecord("delivery_dockets", fx.otherDocketId, { to_client_id: fx.otherClientId, status: "archived", from_client_id: fx.clientId });
    expect(r.ok).toBe(true);
    const row = await withDb(async (c) => (await c.query("SELECT from_client_id, status FROM delivery_dockets WHERE id = $1", [fx.otherDocketId])).rows[0]);
    expect(row).toEqual({ from_client_id: String(SENDER_CLIENT_ID), status: "archived" });
  });
});
