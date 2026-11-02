import bcrypt from "bcryptjs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createFixture, type Fixture, removeFixture } from "../helpers/fixtures";
import { withDb } from "../helpers/test-db";

// Spec 08: the create dialogs save through saveRecord(key, null, values), exactly as the create
// pages do. These pin the results the dialog acts on (AC-4, AC-5, AC-6, AC-9). The FROM_CLIENT_ID
// refusal (AC-6) stays covered by tests/integration/actions.test.ts.
const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string } } }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  auth: async () => session.current,
  requireSession: async () => {
    if (!session.current) throw new Error("NEXT_REDIRECT /login");
    return session.current;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const one = <T = Record<string, unknown>>(text: string, params: unknown[] = []) =>
  withDb(async (c) => (await c.query(text, params)).rows[0] as T);

let fx: Fixture;
beforeAll(async () => {
  fx = await createFixture();
});
afterAll(() => removeFixture(fx.tag));
beforeEach(() => {
  session.current = { user: { id: "1", email: `${fx.tag}-admin@example.com` } };
});
const actions = () => import("@/lib/resources/actions");

describe("08 AC-4 / AC-5 create stays on the list", () => {
  it("a create returns the list as redirectTo and the created message; two creates make two records", async () => {
    const { saveRecord } = await actions();
    const a = await saveRecord("product_types", null, { name: `${fx.tag} PT1`, code: `${fx.tag}P1`, millimetres_per_pleat: "" });
    const b = await saveRecord("product_types", null, { name: `${fx.tag} PT2`, code: `${fx.tag}P2`, millimetres_per_pleat: "" });
    expect(a).toMatchObject({ ok: true, redirectTo: "/product-types", message: "Product Type successfully created" });
    expect(b.ok).toBe(true);
    const n = await one<{ n: number }>("SELECT count(*)::int AS n FROM product_types WHERE name ILIKE $1", [`${fx.tag} PT%`]);
    expect(n.n).toBe(2);
  });
});

describe("08 AC-6 dockets go to their detail page", () => {
  it("a docket create returns the new docket's detail page", async () => {
    const { saveRecord } = await actions();
    const r = await saveRecord("delivery_dockets", null, { to_client_id: fx.clientId, status: "current" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.redirectTo).toBe(`/delivery-dockets/${r.id}`);
    expect(r.message).toBe("Delivery Docket successfully created");
  });
});

describe("08 AC-9 users from the dialog", () => {
  it("requires a password on create", async () => {
    const { saveRecord } = await actions();
    const r = await saveRecord("users", null, { name: "", email: `${fx.tag}-nopw@example.com`, password: "" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.fieldErrors?.password).toBeTruthy();
  });

  it("stores a blank name as NULL and the password as a bcrypt hash", async () => {
    const { saveRecord } = await actions();
    const email = `${fx.tag}-dlg@example.com`;
    const r = await saveRecord("users", null, { name: "   ", email, password: "dialog-password-1" });
    expect(r.ok).toBe(true);
    const u = await one<{ name: string | null; password_hash: string }>("SELECT name, password_hash FROM users WHERE email = $1", [email]);
    expect(u.name).toBeNull();
    expect(await bcrypt.compare("dialog-password-1", u.password_hash)).toBe(true);
  });
});
