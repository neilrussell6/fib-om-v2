import { afterEach, describe, expect, it, vi } from "vitest";

// AC-19: SQLSTATE → friendly message, with display names; anything else is generic and logged.
afterEach(() => vi.restoreAllMocks());

const pgError = (fields: Record<string, unknown>) => Object.assign(new Error(String(fields.message ?? "db error")), fields);

describe("AC-19 mapDbError", () => {
  const load = () => import("@/lib/db/errors");

  it.each([
    ["clients", "orders", "cannot delete clients that still have orders"],
    ["orders", "order_items", "cannot delete orders that still have order items"],
    ["delivery_dockets", "orders", "cannot delete delivery dockets that still have orders"],
    ["product_types", "products", "cannot delete product types that still have products"],
    ["product_categories", "products", "cannot delete product categories that still have products"],
    ["products", "order_items", "cannot delete products that still have order items"],
  ])("23503 on delete of %s referenced by %s", async (table, referencing, expected) => {
    const { mapDbError } = await load();
    const err = pgError({
      code: "23503",
      message: `update or delete on table "${table}" violates foreign key constraint "${referencing}_x_fkey" on table "${referencing}"`,
      table: referencing,
    });
    expect(mapDbError(err, "delete")).toBe(expected);
  });

  it("23502 → please provide a <column without _id>", async () => {
    const { mapDbError } = await load();
    expect(mapDbError(pgError({ code: "23502", column: "client_id" }), "save")).toBe("please provide a client");
    expect(mapDbError(pgError({ code: "23502", column: "due_date" }), "save")).toBe("please provide a due date");
  });

  it("23514 → please provide a valid <column>", async () => {
    const { mapDbError } = await load();
    expect(mapDbError(pgError({ code: "23514", column: "email" }), "save")).toBe("please provide a valid email");
  });

  it("22003 (numeric out of range) → please provide a valid integer", async () => {
    const { mapDbError } = await load();
    expect(mapDbError(pgError({ code: "22003" }), "save")).toBe("please provide a valid integer");
  });

  it("22P02 → please provide a valid integer", async () => {
    const { mapDbError } = await load();
    expect(mapDbError(pgError({ code: "22P02" }), "save")).toBe("please provide a valid integer");
  });

  it.each(["22007", "22008"])("%s → please provide a valid date", async (code) => {
    const { mapDbError } = await load();
    expect(mapDbError(pgError({ code }), "save")).toBe("please provide a valid date");
  });

  it("23505 on users.email → email already in use", async () => {
    const { mapDbError } = await load();
    expect(mapDbError(pgError({ code: "23505", table: "users", constraint: "users_email_key" }), "save")).toBe(
      "email already in use",
    );
  });

  it("anything else → Something went wrong, logged, raw text never returned", async () => {
    const { mapDbError } = await load();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const raw = new Error('relation "secret_table" does not exist');
    const msg = mapDbError(raw, "save");
    expect(msg).toBe("Something went wrong");
    expect(msg).not.toContain("secret_table");
    expect(log).toHaveBeenCalled();
    expect(log.mock.calls.flat()).toContain(raw);
  });
});
