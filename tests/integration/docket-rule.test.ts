import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createFixture, type Fixture, removeFixture } from "../helpers/fixtures";
import { directDatabaseUrl, withDb } from "../helpers/test-db";

// Spec 09 B2: a delivery docket's To Client can't move away from the client of its orders,
// and both docket rules run in the same transaction as their write.
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
beforeAll(async () => {
  fx = await createFixture();
});
afterAll(() => removeFixture(fx.tag));
beforeEach(async () => {
  session.current = { user: { id: "1", email: `${fx.tag}@example.com` } };
  // Each test starts with: docket on client A, holding the fixture order (client A).
  await withDb(async (c) => {
    await c.query("UPDATE delivery_dockets SET to_client_id = $1 WHERE id = $2", [fx.clientId, fx.docketId]);
    await c.query("UPDATE orders SET client_id = $1, delivery_docket_id = $2 WHERE id = $3", [fx.clientId, fx.docketId, fx.orderId]);
  });
});

const docketClient = () =>
  withDb(async (c) => Number((await c.query("SELECT to_client_id FROM delivery_dockets WHERE id = $1", [fx.docketId])).rows[0].to_client_id));

describe("09 AC-3 docket To Client rule", () => {
  it("refuses a To Client other than its orders' client, and leaves the row unchanged", async () => {
    const { saveRecord } = await actions();
    const r = await saveRecord("delivery_dockets", fx.docketId, { to_client_id: String(fx.otherClientId), status: "current" });
    expect(r).toEqual({ ok: false, error: "delivery docket has orders for another client" });
    expect(await docketClient()).toBe(fx.clientId);
  });

  it("saves with the orders' own client", async () => {
    const { saveRecord } = await actions();
    const r = await saveRecord("delivery_dockets", fx.docketId, { to_client_id: String(fx.clientId), status: "current" });
    expect(r.ok).toBe(true);
  });

  it("saves the other client once the order belongs to it", async () => {
    await withDb((c) => c.query("UPDATE orders SET client_id = $1 WHERE id = $2", [fx.otherClientId, fx.orderId]));
    const { saveRecord } = await actions();
    const r = await saveRecord("delivery_dockets", fx.docketId, { to_client_id: String(fx.otherClientId), status: "current" });
    expect(r.ok).toBe(true);
    expect(await docketClient()).toBe(fx.otherClientId);
  });

  it("a docket with no orders can change To Client", async () => {
    await withDb((c) => c.query("UPDATE orders SET delivery_docket_id = NULL WHERE id = $1", [fx.orderId]));
    const { saveRecord } = await actions();
    const r = await saveRecord("delivery_dockets", fx.docketId, { to_client_id: String(fx.otherClientId), status: "current" });
    expect(r.ok).toBe(true);
    expect(await docketClient()).toBe(fx.otherClientId);
  });
});

describe("09 AC-4 the rules run in the write's transaction", () => {
  // The race the lock closes: a colleague's docket edit moves its To Client while an order save
  // is checking that docket. The order save must wait for that edit, then judge the docket as
  // committed: here, refuse it. Without the FOR SHARE read inside the write's transaction, the
  // save reads the old To Client and attaches the order to another client's docket.
  it("an order save waits for an uncommitted To Client change on its docket, then refuses it", async () => {
    await withDb((c) => c.query("UPDATE orders SET delivery_docket_id = NULL WHERE id = $1", [fx.orderId]));
    const colleague = new pg.Client({ connectionString: directDatabaseUrl() });
    await colleague.connect();
    try {
      await colleague.query("BEGIN");
      await colleague.query("UPDATE delivery_dockets SET to_client_id = $1 WHERE id = $2", [fx.otherClientId, fx.docketId]);

      const { saveRecord } = await actions();
      let done = false;
      const save = saveRecord("orders", fx.orderId, {
        client_id: String(fx.clientId),
        order_number: fx.names.orderNumber,
        due_date: "2026-12-01",
        status: "new",
        delivery_docket_id: String(fx.docketId),
      }).then((r) => {
        done = true;
        return r;
      });

      await new Promise((r) => setTimeout(r, 500));
      expect(done, "the order save didn't wait for the docket edit").toBe(false);
      await colleague.query("COMMIT");
      expect(await save).toEqual({ ok: false, error: "delivery docket belongs to another client" });
      const attached = await withDb(async (c) => (await c.query("SELECT delivery_docket_id FROM orders WHERE id = $1", [fx.orderId])).rows[0].delivery_docket_id);
      expect(attached).toBeNull();
    } finally {
      await colleague.query("ROLLBACK").catch(() => {});
      await colleague.end();
    }
  });
});
