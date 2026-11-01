// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

// Spec 06 AC-3: the design's grouped sidebar.
const GROUPS = [
  ["Operations", ["Dashboard", "Orders", "Order Items", "Delivery Dockets"]],
  ["Catalogue", ["Products", "Product Categories", "Product Types", "Product Sizes", "Product Media"]],
  ["Admin", ["Clients", "Users"]],
] as const;

const ICONS: Record<string, string> = {
  Dashboard: "LayoutGrid",
  Orders: "ShoppingCart",
  "Order Items": "ListOrdered",
  "Delivery Dockets": "Truck",
  Products: "Package",
  "Product Categories": "ListTree",
  "Product Types": "Tags",
  "Product Sizes": "Ruler",
  "Product Media": "Layers",
  Clients: "Building2",
  Users: "Users",
};

describe("06 AC-3 navigation groups", () => {
  it("defines the three groups with the design's items in order", async () => {
    const { NAV_GROUPS } = await import("@/components/app-shell/nav-items");
    expect(NAV_GROUPS.map((g) => [g.label, g.items.map((i) => i.label)])).toEqual(GROUPS.map(([l, i]) => [l, [...i]]));
  });

  it("uses the design's Lucide icon for each item", async () => {
    const { NAV_GROUPS } = await import("@/components/app-shell/nav-items");
    const lucide = await import("lucide-react");
    for (const item of NAV_GROUPS.flatMap((g) => g.items)) {
      expect(item.icon, item.label).toBe((lucide as Record<string, unknown>)[ICONS[item.label]]);
      expect(item.href).toMatch(/^\//);
    }
  });

  it("NAV_ITEMS is the flattened group list", async () => {
    const { NAV_GROUPS, NAV_ITEMS } = await import("@/components/app-shell/nav-items");
    expect(NAV_ITEMS).toEqual(NAV_GROUPS.flatMap((g) => g.items));
    expect(NAV_ITEMS[0].href).toBe("/");
  });

  it("renders group headings and items, marking the active one", async () => {
    const { NAV_GROUPS } = await import("@/components/app-shell/nav-items");
    const { SidebarNav } = await import("@/components/app-shell/sidebar-nav");
    render(<SidebarNav groups={NAV_GROUPS} activeHref="/order-items/12" />);
    for (const [label] of GROUPS) expect(screen.getByText(label)).toBeTruthy();
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.textContent?.trim())).toEqual(GROUPS.flatMap(([, items]) => [...items]));
    const active = screen.getByRole("link", { name: "Order Items" });
    expect(active.getAttribute("aria-current")).toBe("page");
    expect(within(active).getByTestId("nav-icon")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Orders" }).getAttribute("aria-current")).toBeNull();
  });

  it("keeps an accessible name and tooltip on each link when collapsed", async () => {
    const { NAV_GROUPS } = await import("@/components/app-shell/nav-items");
    const { SidebarNav } = await import("@/components/app-shell/sidebar-nav");
    render(<SidebarNav groups={NAV_GROUPS} activeHref="/" collapsed />);
    for (const item of NAV_GROUPS.flatMap((g) => g.items)) {
      const link = screen.getByRole("link", { name: item.label });
      expect(link.getAttribute("title")).toBe(item.label);
    }
  });
});
