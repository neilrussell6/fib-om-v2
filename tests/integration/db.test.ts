import { describe, expect, it } from "vitest";
import { withDb } from "../helpers/test-db";

// Design: DB access — the same @neondatabase/serverless driver works against the local proxy.
describe("lib/db (direct pg locally)", () => {
  it("runs a tagged-template query with parameters", async () => {
    const { sql } = await import("@/lib/db");
    const rows = (await sql`SELECT ${41}::int + 1 AS answer`) as { answer: number }[];
    expect(rows[0].answer).toBe(42);
  });

  it("commits a transaction and rolls back on error", async () => {
    const { tx } = await import("@/lib/db");
    const ip = `tx-test-${Date.now()}`;
    await tx(async (client) => {
      await client.query("INSERT INTO login_attempts (ip) VALUES ($1)", [ip]);
    });
    await expect(
      tx(async (client) => {
        await client.query("INSERT INTO login_attempts (ip) VALUES ($1)", [`${ip}-rolled-back`]);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const counts = await withDb(async (c) => {
      const kept = await c.query("SELECT count(*)::int AS n FROM login_attempts WHERE ip = $1", [ip]);
      const gone = await c.query("SELECT count(*)::int AS n FROM login_attempts WHERE ip = $1", [`${ip}-rolled-back`]);
      await c.query("DELETE FROM login_attempts WHERE ip LIKE 'tx-test-%'");
      return { kept: kept.rows[0].n, gone: gone.rows[0].n };
    });
    expect(counts).toEqual({ kept: 1, gone: 0 });
  });
});

// AC-6 / AC-15: schema shape.
describe("schema", () => {
  it("has users and login_attempts and no sessions table", async () => {
    const tables = await withDb(async (c) => {
      const r = await c.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
      );
      return r.rows.map((x: { table_name: string }) => x.table_name);
    });
    expect(tables).toEqual(expect.arrayContaining(["users", "login_attempts"]));
    expect(tables.filter((t: string) => /session/.test(t))).toEqual([]);
  });

  it("rejects a duplicate email", async () => {
    const email = `dup-${Date.now()}@example.com`;
    await withDb(async (c) => {
      await c.query("INSERT INTO users (email, password_hash) VALUES ($1, 'x')", [email]);
      await expect(c.query("INSERT INTO users (email, password_hash) VALUES ($1, 'x')", [email])).rejects.toThrow();
      await c.query("DELETE FROM users WHERE email = $1", [email]);
    });
  });
});
