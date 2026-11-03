// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Spec 09 T E5 (moved down from e2e list-panels "each panel holds every field of the resource's
// edit form"): the edit panel renders every edit-form field of every resource, from the config.
// The Server Action, the router, toasts and the reference API are mocked; nothing is saved.
vi.mock("@/lib/resources/actions", () => ({ saveRecord: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  // Wide screen: the side panel, not the sheet.
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} })) as never;
  globalThis.fetch = vi.fn(async () => new Response("[]", { status: 200 })) as never;
});
afterEach(cleanup);

// The panel pulls in the whole form stack; load it once, outside the per-test timeout.
let mods: [typeof import("@/components/resource/record-panel"), typeof import("@/lib/resources")];
beforeAll(async () => {
  mods = await Promise.all([import("@/components/resource/record-panel"), import("@/lib/resources")]);
}, 60_000);

const KEYS = [
  "users", "clients", "product_categories", "product_types", "product_sizes", "product_media",
  "products", "orders", "order_items", "delivery_dockets",
] as const;

/** A record with a plausible value for every field, so every control renders filled in. */
function fixtureRecord(fields: { name: string; type: string; display?: string; options?: { value: string }[] }[]) {
  const record: Record<string, unknown> = { id: 1 };
  for (const f of fields) {
    if (f.type === "boolean") record[f.name] = true;
    else if (f.type === "reference") {
      record[f.name] = 1;
      if (f.display) record[f.display] = "Label";
    } else if (f.options?.length) record[f.name] = f.options[0].value;
    else if (f.type === "date") record[f.name] = "2026-12-01";
    else if (f.type === "number") record[f.name] = 1;
    else if (f.type !== "password") record[f.name] = "x";
  }
  record.email ??= "x@example.com";
  return record;
}

/** The control a field renders: a chip group, a switch, a combobox or a labelled input. */
function controlFor(scope: ReturnType<typeof within>, f: { label: string; type: string; chips?: true }) {
  if (f.chips) return scope.getByRole("radiogroup", { name: f.label });
  if (f.type === "boolean") return scope.getByRole("switch", { name: f.label });
  if (f.type === "reference") return scope.getByRole("combobox", { name: f.label });
  return scope.getByLabelText(f.label, { exact: true });
}

describe("09 T E5 each panel holds every field of the resource's edit form", () => {
  it.each(KEYS)("%s", async (key) => {
    const [{ RecordPanel }, { formFields, getResource }] = mods;
    const ui = getResource(key);
    const fields = formFields(ui);
    render(<RecordPanel resourceKey={key} record={fixtureRecord(ui.fields)} baseQuery="" activeStatus="" />);
    const panel = within(screen.getByRole("region", { name: `Edit ${ui.singular.toLowerCase()}` }));

    // Grouped fields sit in collapsed sections: open each one first.
    for (const g of new Set(fields.filter((f) => f.group).map((f) => f.group!))) {
      fireEvent.click(panel.getByRole("button", { name: new RegExp(`^${g.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) }));
    }
    for (const f of fields) expect(controlFor(panel, f), `${key}.${f.name}`).toBeTruthy();
  }, 30_000);
});
