import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { removeFixture, uid } from "../helpers/fixtures";
import { withDb } from "../helpers/test-db";

// Spec 06 AC-10 / AC-4: optional users.name, blank stored as NULL, and the user lookup behind the sidebar name.
const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string } } }));
vi.mock("@/lib/auth", () => ({
  auth: async () => session.current,
  requireSession: async () => {
    if (!session.current) throw new Error("NEXT_REDIRECT /login");
    return session.current;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const tag = `un${uid()}`;
let userId: number;
beforeAll(async () => {
  userId = await withDb(async (c) =>
    Number((await c.query("INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id", [`${tag}@example.com`])).rows[0].id),
  );
});
afterAll(() => removeFixture(tag));
beforeEach(() => {
  session.current = { user: { id: String(userId), email: `${tag}@example.com` } };
});

const stored = () => withDb(async (c) => (await c.query("SELECT name FROM users WHERE id = $1", [userId])).rows[0].name);

describe("06 AC-10 users.name", () => {
  it("is a nullable text column", async () => {
    const col = await withDb(async (c) =>
      (await c.query("SELECT data_type, is_nullable FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'name'")).rows[0],
    );
    expect(col).toEqual({ data_type: "text", is_nullable: "YES" });
  });

  it("saves a trimmed name, and a blank name as NULL", async () => {
    const { saveRecord } = await import("@/lib/resources/actions");
    expect((await saveRecord("users", userId, { name: "  Neil Russell ", email: `${tag}@example.com`, password: "" })).ok).toBe(true);
    expect(await stored()).toBe("Neil Russell");
    expect((await saveRecord("users", userId, { name: "   ", email: `${tag}@example.com`, password: "" })).ok).toBe(true);
    expect(await stored()).toBeNull();
  });
});

// Spec 09 P2 / AC-9: getUserDisplay was folded into the session check's lookup, getSessionUser.
describe("06 AC-4 getSessionUser (was getUserDisplay)", () => {
  it("returns the session version, name and email, or null for an unknown or malformed id", async () => {
    await withDb((c) => c.query("UPDATE users SET name = 'Neil Russell' WHERE id = $1", [userId]));
    const version = await withDb(async (c) => Number((await c.query("SELECT session_version FROM users WHERE id = $1", [userId])).rows[0].session_version));
    const { getSessionUser } = await import("@/lib/db/queries/users");
    expect(await getSessionUser(userId)).toEqual({ sessionVersion: version, name: "Neil Russell", email: `${tag}@example.com` });
    expect(await getSessionUser(999999999)).toBeNull();
    expect(await getSessionUser("abc")).toBeNull();
  });
});
