import { describe, expect, it } from "vitest";

// Spec 09 Tests and CI: the list URL helpers, moved out of pages.tsx so they import without
// server-only modules.
const load = () => import("@/components/resource/list-params");

describe("09 list-params first", () => {
  it("takes the first of a repeated param, the value itself, or undefined", async () => {
    const { first } = await load();
    expect(first(["a", "b"])).toBe("a");
    expect(first("a")).toBe("a");
    expect(first(undefined)).toBeUndefined();
  });
});

describe("09 list-params newHref", () => {
  it("adds new=1 to the list's query", async () => {
    const { newHref } = await load();
    expect(newHref("/clients", "")).toBe("/clients?new=1");
    expect(newHref("/clients", "name=a&page=2")).toBe("/clients?name=a&page=2&new=1");
  });
});

describe("09 list-params queryWithout", () => {
  it("drops the given keys and keeps the rest, including repeated values", async () => {
    const { queryWithout } = await load();
    expect(queryWithout({ item: "5", new: "1", name: "a", tag: ["x", "y"], gone: undefined }, "item", "new")).toBe("name=a&tag=x&tag=y");
  });

  it("encodes values", async () => {
    const { queryWithout } = await load();
    expect(queryWithout({ name: "a b&c" })).toBe("name=a+b%26c");
  });
});

describe("09 list-params listParamsFromUrl", () => {
  it("keeps only the resource's filter keys, with values", async () => {
    const { listParamsFromUrl } = await load();
    const p = listParamsFromUrl("products", { name: "x", type: "3", bogus: "1", size: "" });
    expect(p.filters).toEqual({ name: "x", type: "3" });
  });

  it("accepts a column sort key and its direction, defaulting to asc", async () => {
    const { listParamsFromUrl } = await load();
    expect(listParamsFromUrl("clients", { sort: "name", dir: "desc" })).toMatchObject({ sort: "name", dir: "desc" });
    expect(listParamsFromUrl("clients", { sort: "name", dir: "sideways" })).toMatchObject({ sort: "name", dir: "asc" });
  });

  it("ignores an unknown sort key, and then any direction", async () => {
    const { listParamsFromUrl } = await load();
    expect(listParamsFromUrl("clients", { sort: "id; DROP", dir: "desc" })).toMatchObject({ sort: undefined, dir: undefined });
  });

  it("parses page and pageSize, falling back for junk", async () => {
    const { listParamsFromUrl } = await load();
    expect(listParamsFromUrl("clients", { page: "3", pageSize: "50" })).toMatchObject({ page: 3, pageSize: 50 });
    expect(listParamsFromUrl("clients", { page: "x" })).toMatchObject({ page: 1, pageSize: undefined });
  });
});
