import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec 09 B1 / AC-2: searchReferences refuses a non-id before any SQL. `query` is the real
// one, wrapped in a spy so the test can see what reached the database.
const sent = vi.hoisted(() => ({ sql: [] as string[] }));
vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...real,
    query: (text: string, params?: unknown[]) => {
      sent.sql.push(text);
      return real.query(text, params);
    },
  };
});

beforeEach(() => {
  sent.sql = [];
});

describe("09 AC-2 searchReferences ids", () => {
  it.each([
    [{ id: "abc" }],
    [{ id: "1.5" }],
    [{ clientId: "1x" }],
  ])("rejects %j with UnknownKeyError and sends no SQL", async (opts) => {
    const { searchReferences } = await import("@/lib/db/reference-search");
    const { UnknownKeyError } = await import("@/lib/db/list-query");
    const key = "clientId" in opts ? "delivery_dockets" : "clients";
    await expect(searchReferences(key, opts)).rejects.toBeInstanceOf(UnknownKeyError);
    expect(sent.sql).toEqual([]);
  });

  it("a numeric id still queries", async () => {
    const { searchReferences } = await import("@/lib/db/reference-search");
    await expect(searchReferences("clients", { id: "999999999" })).resolves.toEqual([]);
    expect(sent.sql).toHaveLength(1);
  });
});
