import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Spec 06 AC-27 / task review B1: the page-only query module must never become callable from the browser.
const read = (p: string) => readFileSync(p, "utf8");

describe("06 AC-27 panel module split", () => {
  it("panel-queries.ts is server-only and has no 'use server' directive", () => {
    const src = read("lib/order-items/panel-queries.ts");
    expect(src).toMatch(/import\s+["']server-only["']/);
    expect(src).not.toMatch(/["']use server["']/);
  });

  it("panel-actions.ts is a Server Actions module that checks the session in every action", () => {
    const src = read("lib/order-items/panel-actions.ts");
    expect(src.trimStart().startsWith('"use server"')).toBe(true);
    for (const fn of ["getProductPanelInfo", "getOrderPanelInfo", "saveOrderItemPanel"]) {
      const body = new RegExp(`export async function ${fn}\\([^)]*\\)[^{]*\\{[\\s\\S]*?requireSession\\(\\)`);
      expect(src, fn).toMatch(body);
    }
  });
});
