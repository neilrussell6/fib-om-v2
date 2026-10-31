import { describe, expect, it } from "vitest";

// Shared zod schemas (client and Server Action) built from each resource's fields.
const load = () => import("@/lib/resources/schema");

describe("AC-31 required fields", () => {
  it("a client needs only a name; empty optional fields become null", async () => {
    const { buildSchema } = await load();
    const parsed = buildSchema("clients", "create").parse({ name: " Acme ", full_name: "", phone: "  ", label_use_part_number: false });
    expect(parsed.name).toBe("Acme");
    expect(parsed.full_name).toBeNull();
    expect(parsed.phone).toBeNull();
  });

  it("a client without a name fails on name", async () => {
    const { buildSchema } = await load();
    const r = buildSchema("clients", "create").safeParse({ name: "" });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.path[0])).toContain("name");
  });

  it.each([
    ["product_types", ["name", "code"]],
    ["product_media", ["name", "code"]],
    ["product_sizes", ["name"]],
    ["product_categories", ["name"]],
    ["products", ["name", "category_id", "type_id", "size_id", "media_id"]],
    ["orders", ["client_id", "order_number", "due_date"]], // status defaults to New (AC-26)
    ["order_items", ["order_id", "product_id", "part_number", "quantity", "height", "width", "depth"]],
    ["delivery_dockets", ["to_client_id"]],
  ] as const)("%s requires %j", async (key, required) => {
    const { buildSchema } = await load();
    const r = buildSchema(key, "create").safeParse({});
    expect(r.success).toBe(false);
    const failed = new Set(r.error!.issues.map((i) => String(i.path[0])));
    for (const f of required) expect(failed, f).toContain(f);
  });
});

describe("AC-3 numbers accept any integer (no extra rules)", () => {
  it("quantity -1 and height 0 pass", async () => {
    const { buildSchema } = await load();
    const r = buildSchema("order_items", "create").safeParse({
      order_id: 1, product_id: 1, part_number: "P", quantity: -1, height: 0, width: 1, depth: 1,
    });
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
  });

  it("a non-integer quantity fails", async () => {
    const { buildSchema } = await load();
    const r = buildSchema("order_items", "create").safeParse({
      order_id: 1, product_id: 1, part_number: "P", quantity: "abc", height: 1, width: 1, depth: 1,
    });
    expect(r.success).toBe(false);
  });
});

describe("AC-22 user schema", () => {
  it("create requires email and a 12+ character password", async () => {
    const { buildSchema } = await load();
    expect(buildSchema("users", "create").safeParse({ email: "a@b.co", password: "short" }).success).toBe(false);
    expect(buildSchema("users", "create").safeParse({ email: "a@b.co" }).success).toBe(false);
    expect(buildSchema("users", "create").safeParse({ email: "A@B.co", password: "long-enough-pw" }).data).toMatchObject({
      email: "a@b.co",
    });
  });

  it("edit allows a blank password (kept) but still enforces 12+ when given", async () => {
    const { buildSchema } = await load();
    const s = buildSchema("users", "edit");
    expect(s.parse({ email: "a@b.co", password: "" }).password).toBeUndefined();
    expect(s.safeParse({ email: "a@b.co", password: "short" }).success).toBe(false);
  });
});

describe("AC-26 order status", () => {
  it("defaults to new and accepts only new/complete/archived", async () => {
    const { buildSchema } = await load();
    const s = buildSchema("orders", "create");
    const base = { client_id: 1, order_number: "X", due_date: "2026-12-01" };
    expect(s.parse(base).status).toBe("new");
    expect(s.safeParse({ ...base, status: "approved" }).success).toBe(false);
  });
});

describe("Review 02 finding 4: integers stay within the 32-bit column range", () => {
  it.each([2147483648, -2147483649, 99999999999])("%s is rejected with 'please provide a valid integer'", async (n) => {
    const { buildSchema } = await load();
    const r = buildSchema("order_items", "create").safeParse({
      order_id: 1, product_id: 1, part_number: "P", quantity: n, height: 1, width: 1, depth: 1,
    });
    expect(r.success).toBe(false);
    expect(r.error!.issues.find((i) => i.path[0] === "quantity")?.message).toBe("please provide a valid integer");
  });

  it("2147483647 is accepted", async () => {
    const { buildSchema } = await load();
    expect(buildSchema("product_types", "create").safeParse({ name: "a", code: "b", millimetres_per_pleat: 2147483647 }).success).toBe(true);
  });
});
