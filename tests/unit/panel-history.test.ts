import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec 07 fix 2 (AC-17) and the task-review refinement for switching rows (tasks 2.3).
const KEY = "panel-opened";

let store: Map<string, string>;
let throwing = false;
const location = { pathname: "/clients", search: "" };

function setUrl(href: string) {
  const u = new URL(href, "http://app.test");
  location.pathname = u.pathname;
  location.search = u.search;
}

beforeEach(() => {
  store = new Map();
  throwing = false;
  setUrl("/clients");
  const sessionStorage = {
    getItem: (k: string) => {
      if (throwing) throw new Error("blocked");
      return store.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (throwing) throw new Error("blocked");
      store.set(k, v);
    },
    removeItem: (k: string) => {
      if (throwing) throw new Error("blocked");
      store.delete(k);
    },
  };
  vi.stubGlobal("window", { location, sessionStorage });
  vi.stubGlobal("sessionStorage", sessionStorage);
});
afterEach(() => vi.unstubAllGlobals());

const router = () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn() });
const load = () => import("@/components/resource/panel/history");

describe("07 fix 2 closePanel", () => {
  it("goes back when the panel was opened from the list, and clears the marker", async () => {
    const { markOpenedFromList, closePanel } = await load();
    markOpenedFromList("/clients?item=5");
    setUrl("/clients?item=5");
    const r = router();
    closePanel(r, "/clients", { saved: false });
    expect(r.back).toHaveBeenCalledTimes(1);
    expect(r.replace).not.toHaveBeenCalled();
    expect(r.refresh).not.toHaveBeenCalled();
    expect(store.has(KEY)).toBe(false);
  });

  it("refreshes after going back when the panel saved", async () => {
    const { markOpenedFromList, closePanel } = await load();
    markOpenedFromList("/clients?item=5");
    setUrl("/clients?item=5");
    const r = router();
    closePanel(r, "/clients", { saved: true });
    expect(r.back).toHaveBeenCalledTimes(1);
    expect(r.refresh).toHaveBeenCalledTimes(1);
  });

  it("replaces when there is no marker (a direct load)", async () => {
    const { closePanel } = await load();
    setUrl("/clients?item=5");
    const r = router();
    closePanel(r, "/clients", { saved: true });
    expect(r.back).not.toHaveBeenCalled();
    expect(r.replace).toHaveBeenCalledWith("/clients", { scroll: false });
    expect(r.refresh).toHaveBeenCalledTimes(1);
  });

  it("replaces when the marker points at another URL (the list changed while open)", async () => {
    const { markOpenedFromList, closePanel } = await load();
    markOpenedFromList("/orders?item=5");
    setUrl("/orders?status=new&item=5");
    const r = router();
    closePanel(r, "/orders?status=new", { saved: false });
    expect(r.back).not.toHaveBeenCalled();
    expect(r.replace).toHaveBeenCalledWith("/orders?status=new", { scroll: false });
    expect(store.has(KEY)).toBe(false);
  });

  it("replaces when storage is unavailable", async () => {
    const { closePanel } = await load();
    setUrl("/clients?item=5");
    throwing = true;
    const r = router();
    expect(() => closePanel(r, "/clients", { saved: false })).not.toThrow();
    expect(r.replace).toHaveBeenCalledWith("/clients", { scroll: false });
    expect(r.back).not.toHaveBeenCalled();
  });
});

describe("07 openPanel (switching rows)", () => {
  it("with no panel open, marks the target and pushes", async () => {
    const { openPanel } = await load();
    const r = router();
    openPanel(r, "/clients?item=5");
    expect(r.push).toHaveBeenCalledWith("/clients?item=5", { scroll: false });
    expect(r.replace).not.toHaveBeenCalled();
    expect(store.get(KEY)).toBe("/clients?item=5");
  });

  it("with a list-opened panel open, replaces and moves the marker to the new row", async () => {
    const { openPanel, closePanel } = await load();
    const r = router();
    openPanel(r, "/clients?item=5");
    setUrl("/clients?item=5");
    openPanel(r, "/clients?item=6");
    expect(r.replace).toHaveBeenCalledWith("/clients?item=6", { scroll: false });
    expect(r.push).toHaveBeenCalledTimes(1);
    expect(store.get(KEY)).toBe("/clients?item=6");
    setUrl("/clients?item=6");
    closePanel(r, "/clients", { saved: false });
    expect(r.back).toHaveBeenCalledTimes(1); // back to the list, not to item 5
  });

  it("with a directly loaded panel open, replaces and leaves the marker unset", async () => {
    const { openPanel } = await load();
    setUrl("/clients?item=5");
    const r = router();
    openPanel(r, "/clients?item=6");
    expect(r.replace).toHaveBeenCalledWith("/clients?item=6", { scroll: false });
    expect(r.push).not.toHaveBeenCalled();
    expect(store.has(KEY)).toBe(false);
  });

  it("still navigates when storage is unavailable", async () => {
    const { openPanel } = await load();
    throwing = true;
    const r = router();
    expect(() => openPanel(r, "/clients?item=5")).not.toThrow();
    expect(r.push).toHaveBeenCalledWith("/clients?item=5", { scroll: false });
  });
});

describe("07 clearOpenedMarker", () => {
  it("removes the marker only when it still points at the panel's own URL", async () => {
    const { markOpenedFromList, clearOpenedMarker } = await load();
    markOpenedFromList("/clients?item=6");
    clearOpenedMarker("/clients?item=5"); // an older panel unmounting
    expect(store.get(KEY)).toBe("/clients?item=6");
    clearOpenedMarker("/clients?item=6");
    expect(store.has(KEY)).toBe(false);
  });

  it("does not throw when storage is unavailable", async () => {
    const { clearOpenedMarker } = await load();
    throwing = true;
    expect(() => clearOpenedMarker("/clients?item=5")).not.toThrow();
  });
});
