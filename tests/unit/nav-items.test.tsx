// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

const FINAL_ORDER = [
  "Dashboard",
  "Orders",
  "Order Items",
  "Delivery Dockets",
  "Clients",
  "Product Categories",
  "Product Media",
  "Products",
  "Product Sizes",
  "Product Types",
  "Users",
];

// AC-9: the sidebar order is fixed, and only Dashboard is enabled in this feature.
describe("AC-9 sidebar", () => {
  it("defines every entry in the final order, each with an icon and a path", async () => {
    const { ALL_NAV_ITEMS } = await import("@/components/app-shell/nav-items");
    expect(ALL_NAV_ITEMS.map((i) => i.label)).toEqual(FINAL_ORDER);
    for (const item of ALL_NAV_ITEMS) {
      expect(item.href).toMatch(/^\//);
      expect(item.icon).toBeTruthy();
    }
  });

  it("enables only Dashboard in this feature", async () => {
    const { NAV_ITEMS } = await import("@/components/app-shell/nav-items");
    expect(NAV_ITEMS.map((i) => i.label)).toEqual(["Dashboard"]);
    expect(NAV_ITEMS[0].href).toBe("/");
  });

  it("renders entries in the given order with an icon and marks the active one", async () => {
    const { ALL_NAV_ITEMS } = await import("@/components/app-shell/nav-items");
    const { SidebarNav } = await import("@/components/app-shell/sidebar-nav");
    render(<SidebarNav items={ALL_NAV_ITEMS} activeHref="/" />);
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.textContent?.trim())).toEqual(FINAL_ORDER);
    const dashboard = screen.getByRole("link", { name: "Dashboard" });
    expect(dashboard.getAttribute("aria-current")).toBe("page");
    expect(within(dashboard).getByTestId("nav-icon")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Orders" }).getAttribute("aria-current")).toBeNull();
  });
});
