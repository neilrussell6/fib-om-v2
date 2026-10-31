import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFixture, type Fixture, removeFixture } from "../helpers/fixtures";
import { withDb } from "../helpers/test-db";

// AC-12: reference comboboxes search the server, 25 options at a time.
let fx: Fixture;
beforeAll(async () => {
  fx = await createFixture();
  await withDb(async (c) => {
    for (let i = 0; i < 30; i++) await c.query("INSERT INTO product_sizes (name) VALUES ($1)", [`${fx.tag} ref ${i}`]);
  });
});
afterAll(() => removeFixture(fx.tag));

const load = () => import("@/lib/db/reference-search");

describe("AC-12 searchReferences", () => {
  it("returns at most 25 {id, label} options", async () => {
    const { searchReferences } = await load();
    const r = await searchReferences("product_sizes", { q: `${fx.tag} ref` });
    expect(r).toHaveLength(25);
    expect(r[0]).toEqual({ id: expect.any(Number), label: expect.stringContaining(fx.tag) });
  });

  it("matches anywhere, case-insensitively", async () => {
    const { searchReferences } = await load();
    const r = await searchReferences("clients", { q: fx.tag.slice(2).toUpperCase() + " client" });
    expect(r.map((x) => x.label)).toContain(fx.names.client);
  });

  it("looks up a single option by id (to show the current value)", async () => {
    const { searchReferences } = await load();
    expect(await searchReferences("product_types", { id: fx.typeId })).toEqual([
      { id: fx.typeId, label: `${fx.names.typeCode} · ${fx.names.type}` },
    ]);
  });

  it("delivery docket options are zero-padded and limited to the given client", async () => {
    const { searchReferences } = await load();
    const r = await searchReferences("delivery_dockets", { clientId: fx.clientId });
    expect(r).toEqual([{ id: fx.docketId, label: String(fx.docketId).padStart(6, "0") }]);
  });

  it("rejects an unknown resource", async () => {
    const { searchReferences } = await load();
    await expect(searchReferences("pg_shadow" as never, {})).rejects.toThrow(/unknown resource/i);
  });
});
