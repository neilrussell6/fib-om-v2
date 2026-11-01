import { describe, expect, it } from "vitest";
import { SHOW_COLUMNS, V1_CATEGORIES, V1_CATEGORY_RENAMES } from "@/lib/data/v1-categories";

// Spec 03 AC-10. Expected values copied from ../fib-om-v2-reference/migrations/data.sql and
// data-dml-updates.sql (that folder isn't in the repo or CI).
const EXPECTED_NAMES = [
  "V Form Panel Filters",
  "Flat Panel Filters",
  "Bag Filters",
  "Holding Frames",
  "Wire Products",
  "Carbon Filters",
  "Filter Units",
  "Media",
];

const on = (cols: string[]) => Object.fromEntries(SHOW_COLUMNS.map((c) => [c, cols.includes(c)]));

describe("AC-10 v1 categories", () => {
  it("lists every v1 category name after the renames and additions", () => {
    expect(V1_CATEGORIES.map((c) => c.name).sort()).toEqual([...EXPECTED_NAMES].sort());
  });

  it("maps the four legacy names to v1's names", () => {
    expect(V1_CATEGORY_RENAMES).toEqual({
      Bag: "Bag Filters",
      "Flat Panel": "Flat Panel Filters",
      "Holding Frame": "Holding Frames",
      VForm: "V Form Panel Filters",
    });
  });

  it("gives every category every show_* column of product_categories", () => {
    expect(SHOW_COLUMNS).toHaveLength(36);
    for (const c of V1_CATEGORIES) expect(Object.keys(c.flags).sort(), c.name).toEqual([...SHOW_COLUMNS].sort());
  });

  it.each([
    [
      "Bag Filters",
      ["show_product_media_code", "show_quantity", "show_height", "show_width", "show_depth", "show_has_wire_header", "show_has_header_frame"],
    ],
    [
      "V Form Panel Filters",
      [
        "show_quantity", "show_height", "show_width", "show_depth", "show_product_media_code", "show_calculated_id",
        "show_wire_sides", "show_pleats", "show_wire_metres", "show_wire_height", "show_frame_status", "show_package_status",
      ],
    ],
    ["Media", ["show_cut_count", "show_sow_count"]],
  ])("has v1's flags for %s", (name, cols) => {
    const cat = V1_CATEGORIES.find((c) => c.name === name);
    expect(cat?.flags).toEqual(on(cols));
  });
});
