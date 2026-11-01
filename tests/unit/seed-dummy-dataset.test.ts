import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDataset } from "@/scripts/seed-dummy";

// Spec 03: buildDataset is pure, so these run without a database.

describe("AC-2 deterministic dataset", () => {
  it("returns equal values for the same arguments", () => {
    expect(buildDataset(1, 1)).toEqual(buildDataset(1, 1));
    expect(buildDataset(7, 20)).toEqual(buildDataset(7, 20));
  });

  it("returns different values for a different seed", () => {
    expect(buildDataset(2, 1)).not.toEqual(buildDataset(1, 1));
  });
});

describe("AC-4 client ids", () => {
  it.each([1, 20])("gives unique client ids with the sender at %i", (from) => {
    const { clients } = buildDataset(1, from);
    const ids = clients.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const sender = clients.find((c) => c.id === from);
    expect(sender?.name).toBe("Fibatron (dummy)");
    expect(clients.length).toBeGreaterThanOrEqual(31);
    expect(ids.every((id) => Number.isInteger(id) && (id as number) >= 1)).toBe(true);
  });
});

describe("AC-8 nothing looks real", () => {
  const clients = () => buildDataset(1, 1).clients;

  it("has no ABN or ACN values", () => {
    for (const c of clients()) {
      expect(c.abn, `client ${c.id}`).toBeNull();
      expect(c.acn, `client ${c.id}`).toBeNull();
    }
  });

  it("uses only dummy phone numbers", () => {
    for (const c of clients()) {
      for (const col of ["phone", "landline", "fax"] as const) {
        const v = c[col];
        if (v !== null) expect(v, `client ${c.id} ${col}`).toMatch(/^\(00\) 0000 \d{4}$/);
      }
    }
  });

  it("uses only dummy addresses", () => {
    for (const c of clients()) {
      for (const col of ["address_shipping", "address_billing", "label_address_line1", "label_address_line2"] as const) {
        const v = c[col];
        if (v !== null) expect(String(v), `client ${c.id} ${col}`).toMatch(/Dummy/);
      }
    }
  });
});

describe("AC-9 never from CI", () => {
  it("no workflow runs seed-dummy", () => {
    const dir = ".github/workflows";
    for (const f of readdirSync(dir)) {
      const text = readFileSync(`${dir}/${f}`, "utf8");
      expect(text, f).not.toMatch(/seed-dummy|seed:dummy/);
    }
  });
});
