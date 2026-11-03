import { describe, expect, it } from "vitest";
import { SIDEBAR_COOKIE } from "@/components/app-shell/sidebar-state";

// Spec 09 Tests and CI: the cookie name shared by the server sidebar and the client frame (spec 06 AC-5).
describe("09 sidebar-state", () => {
  it("names the collapse cookie 'sidebar'", () => {
    expect(SIDEBAR_COOKIE).toBe("sidebar");
  });
});
