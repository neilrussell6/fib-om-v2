import { afterEach, describe, expect, it, vi } from "vitest";

// Spec 09 Tests and CI: the panel's success toast and its "Moved to" View action
// (spec 06 AC-25, spec 07 AC-10), with sonner and the history marker mocked.
const success = vi.hoisted(() => vi.fn());
const mark = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { success } }));
vi.mock("@/components/resource/panel/history", () => ({ markOpenedFromList: mark }));

afterEach(() => {
  success.mockReset();
  mark.mockReset();
});

const load = () => import("@/components/resource/panel/saved-toast");
const router = () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn() });
const options = [
  { value: "new", label: "New" },
  { value: "complete", label: "Complete" },
];

describe("09 itemHref", () => {
  it("adds item=<id> to the list query", async () => {
    const { itemHref } = await load();
    expect(itemHref("/orders", "", "5")).toBe("/orders?item=5");
    expect(itemHref("/orders", "client=3&page=2", "5")).toBe("/orders?client=3&page=2&item=5");
  });
});

describe("09 savedToast", () => {
  const base = { message: "Order successfully updated", path: "/orders", baseQuery: "client=3&page=2", id: "5", options };

  it("a plain toast when there is no tab, no saved status, or the status is unchanged", async () => {
    const { savedToast } = await load();
    savedToast({ ...base, router: router(), activeStatus: "" , savedStatus: "complete" });
    savedToast({ ...base, router: router(), activeStatus: "new" });
    savedToast({ ...base, router: router(), activeStatus: "new", savedStatus: "new" });
    expect(success.mock.calls).toEqual([["Order successfully updated"], ["Order successfully updated"], ["Order successfully updated"]]);
  });

  it("a moved-out save says 'Moved to <label>.' with a View action that opens the record on that tab", async () => {
    const { savedToast } = await load();
    const r = router();
    savedToast({ ...base, router: r, activeStatus: "new", savedStatus: "complete" });
    const [text, opts] = success.mock.calls[0];
    expect(text).toBe("Order successfully updated. Moved to Complete.");
    expect(opts.action.label).toBe("View");
    opts.action.onClick();
    // status set, page dropped, other params kept.
    const href = "/orders?client=3&status=complete&item=5";
    expect(mark).toHaveBeenCalledWith(href);
    expect(r.push).toHaveBeenCalledWith(href, { scroll: false });
  });

  it("falls back to the raw status when it has no option label", async () => {
    const { savedToast } = await load();
    savedToast({ ...base, router: router(), activeStatus: "new", savedStatus: "archived" });
    expect(success.mock.calls[0][0]).toBe("Order successfully updated. Moved to archived.");
  });
});
