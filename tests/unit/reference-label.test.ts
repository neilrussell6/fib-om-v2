import { describe, expect, it } from "vitest";
import type { FieldDef } from "@/lib/resources/types";

// Spec 09 P3: the label a reference field's current value shows, built from the record's view row.
const field = (over: Partial<FieldDef>): FieldDef => ({ name: "x_id", label: "X", type: "reference", ref: "clients", display: "x_name", ...over });

describe("09 P3 referenceLabel", () => {
  it("defaults to the display column", async () => {
    const { referenceLabel } = await import("@/lib/resources");
    expect(referenceLabel(field({}), { x_id: 5, x_name: "Acme" })).toBe("Acme");
  });

  it("joins the displayLabel columns with ' · '", async () => {
    const { referenceLabel } = await import("@/lib/resources");
    const f = field({ displayLabel: ["type_code", "type_name"] });
    expect(referenceLabel(f, { type_code: "HEPA", type_name: "High efficiency" })).toBe("HEPA · High efficiency");
  });

  it("returns null when any listed column is null or missing", async () => {
    const { referenceLabel } = await import("@/lib/resources");
    expect(referenceLabel(field({ displayLabel: ["a", "b"] }), { a: "A", b: null })).toBeNull();
    expect(referenceLabel(field({}), { x_id: null, x_name: null })).toBeNull();
    expect(referenceLabel(field({}), {})).toBeNull();
  });

  it("stringifies non-string values (a padded docket number stays as stored)", async () => {
    const { referenceLabel } = await import("@/lib/resources");
    expect(referenceLabel(field({ display: "n" }), { n: "000042" })).toBe("000042");
    expect(referenceLabel(field({ display: "n" }), { n: 42 })).toBe("42");
  });

  it("is set where the label differs from display: product type and media, and an item's order", async () => {
    const { getResource } = await import("@/lib/resources");
    const by = (key: Parameters<typeof getResource>[0], name: string) => getResource(key).fields.find((f) => f.name === name)?.displayLabel;
    expect(by("products", "type_id")).toEqual(["type_code", "type_name"]);
    expect(by("products", "media_id")).toEqual(["media_code", "media_name"]);
    expect(by("order_items", "order_id")).toEqual(["order_number", "client_name"]);
  });
});
