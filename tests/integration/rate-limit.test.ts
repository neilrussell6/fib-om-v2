import { afterEach, describe, expect, it } from "vitest";
import { clearLoginAttempts, withDb } from "../helpers/test-db";

// AC-19: at most 10 sign-in attempts per minute per IP; old rows are pruned.
const ip = "198.51.100.19";
afterEach(() => clearLoginAttempts(ip));

describe("AC-19 checkSignInRateLimit", () => {
  const load = () => import("@/lib/auth/rate-limit");

  it("allows 10 attempts in a minute and refuses the 11th", async () => {
    const { checkSignInRateLimit } = await load();
    const now = new Date("2026-11-01T10:00:00Z");
    for (let i = 0; i < 10; i++) {
      const at = new Date(now.getTime() + i * 1000);
      await expect(checkSignInRateLimit(ip, at)).resolves.toEqual({ allowed: true });
    }
    await expect(checkSignInRateLimit(ip, new Date(now.getTime() + 11_000))).resolves.toEqual({ allowed: false });
  });

  it("allows attempts again once the minute has passed", async () => {
    const { checkSignInRateLimit } = await load();
    const now = new Date("2026-11-01T11:00:00Z");
    for (let i = 0; i < 10; i++) await checkSignInRateLimit(ip, now);
    await expect(checkSignInRateLimit(ip, new Date(now.getTime() + 5_000))).resolves.toEqual({ allowed: false });
    await expect(checkSignInRateLimit(ip, new Date(now.getTime() + 61_000))).resolves.toEqual({ allowed: true });
  });

  it("does not record a refused attempt", async () => {
    const { checkSignInRateLimit } = await load();
    const now = new Date("2026-11-01T12:00:00Z");
    for (let i = 0; i < 12; i++) await checkSignInRateLimit(ip, now);
    const n = await withDb(async (c) => (await c.query("SELECT count(*)::int AS n FROM login_attempts WHERE ip = $1", [ip])).rows[0].n);
    expect(n).toBe(10);
  });

  it("keeps different IPs separate", async () => {
    const { checkSignInRateLimit } = await load();
    const now = new Date("2026-11-01T13:00:00Z");
    for (let i = 0; i < 10; i++) await checkSignInRateLimit(ip, now);
    await expect(checkSignInRateLimit("198.51.100.20", now)).resolves.toEqual({ allowed: true });
    await clearLoginAttempts("198.51.100.20");
  });

  it("deletes rows older than one hour on each attempt", async () => {
    const { checkSignInRateLimit } = await load();
    const now = new Date("2026-11-01T14:00:00Z");
    await withDb((c) =>
      c.query("INSERT INTO login_attempts (ip, attempted_at) VALUES ($1, $2), ($1, $3)", [
        "198.51.100.99",
        new Date(now.getTime() - 61 * 60_000),
        new Date(now.getTime() - 30 * 60_000),
      ]),
    );
    await checkSignInRateLimit(ip, now);
    const rows = await withDb(async (c) => (await c.query("SELECT attempted_at FROM login_attempts WHERE ip = $1", ["198.51.100.99"])).rows);
    expect(rows).toHaveLength(1);
    await clearLoginAttempts("198.51.100.99");
  });
});
