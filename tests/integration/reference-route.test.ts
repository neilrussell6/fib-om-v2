import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createFixture, type Fixture, removeFixture } from "../helpers/fixtures";

// Spec 09 B1: the reference route validates ids before searching. The route handler is
// imported directly, with the session mocked.
const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string } } }));
vi.mock("@/lib/auth", () => ({ auth: async () => session.current }));

const search = vi.hoisted(() => ({ calls: 0 }));
vi.mock("@/lib/db/reference-search", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db/reference-search")>();
  return {
    ...real,
    searchReferences: (...args: Parameters<typeof real.searchReferences>) => {
      search.calls++;
      return real.searchReferences(...args);
    },
  };
});

let fx: Fixture;
beforeAll(async () => {
  fx = await createFixture();
});
afterAll(() => removeFixture(fx.tag));
beforeEach(() => {
  session.current = { user: { id: "1", email: "route@example.com" } };
  search.calls = 0;
});

const get = async (resource: string, query: string) => {
  const { GET } = await import("@/app/api/reference/[resource]/route");
  const res = await GET(new Request(`http://localhost/api/reference/${resource}?${query}`), {
    params: Promise.resolve({ resource }),
  } as never);
  return { status: res.status, body: await res.json(), cache: res.headers.get("cache-control") };
};

describe("09 AC-1 reference route ids", () => {
  it.each([
    ["clients", "id=abc"],
    ["delivery_dockets", "clientId=1x"],
  ])("%s?%s returns 400 invalid id without searching", async (resource, query) => {
    const r = await get(resource, query);
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: "invalid id" });
    expect(r.cache).toBe("no-store");
    expect(search.calls).toBe(0);
  });

  it("?id=<n> and ?q= still answer with options", async () => {
    const byId = await get("clients", `id=${fx.clientId}`);
    expect(byId.status).toBe(200);
    expect(byId.body).toEqual([{ id: fx.clientId, label: fx.names.client }]);
    const byQ = await get("clients", `q=${encodeURIComponent(fx.names.client)}`);
    expect(byQ.status).toBe(200);
    expect(byQ.body.map((o: { id: number }) => o.id)).toContain(fx.clientId);
  });

  it("an empty id is ignored, as before", async () => {
    const r = await get("clients", "id=");
    expect(r.status).toBe(200);
  });

  it("signed out returns 401", async () => {
    session.current = null;
    expect((await get("clients", "id=abc")).status).toBe(401);
  });

  it("an unknown resource returns 404", async () => {
    expect((await get("pg_shadow", "q=a")).status).toBe(404);
  });
});
