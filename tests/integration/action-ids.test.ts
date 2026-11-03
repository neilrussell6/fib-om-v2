import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec 09 B3 / AC-5: a malformed id is "not found" before any database call.
const session = vi.hoisted(() => ({ current: { user: { id: "1", email: "ids@example.com" } } }));
vi.mock("@/lib/auth", () => ({
  auth: async () => session.current,
  requireSession: async () => session.current,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const calls = vi.hoisted(() => ({ n: 0 }));
vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const count =
    <A extends unknown[], R>(fn: (...a: A) => R) =>
    (...a: A): R => {
      calls.n++;
      return fn(...a);
    };
  return { ...real, query: count(real.query), sql: count(real.sql), tx: count(real.tx) };
});

beforeEach(() => {
  calls.n = 0;
});

const KEYS = [
  "users", "clients", "product_categories", "product_types", "product_sizes", "product_media",
  "products", "orders", "order_items", "delivery_dockets",
] as const;

describe("09 AC-5 malformed ids in the actions", () => {
  it.each(KEYS)("%s: save and delete with id 'abc' return '<singular> not found' and send no query", async (key) => {
    const { saveRecord, deleteRecord } = await import("@/lib/resources/actions");
    const { getResource } = await import("@/lib/resources");
    const expected = { ok: false, error: `${getResource(key).singular} not found` };
    // Valid-looking input, so only the id is wrong.
    expect(await saveRecord(key, "abc", { name: "x" })).toEqual(expected);
    expect(await deleteRecord(key, "abc")).toEqual(expected);
    expect(calls.n).toBe(0);
  });
});
