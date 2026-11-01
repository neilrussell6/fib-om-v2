import { describe, expect, it } from "vitest";

// Spec 06 AC-2: the design palette, and WCAG AA contrast for every body-size text pair.
function luminance(hex: string): number {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

describe("06 AC-2 palette", () => {
  it("uses the design palette (with the darkened subtle grey)", async () => {
    const { palette } = await import("@/lib/theme/palette");
    expect(palette).toMatchObject({
      background: "#ffffff",
      foreground: "#1d2326",
      secondaryText: "#5e686d",
      subtle: "#697175",
      iconMuted: "#8a9397",
      label: "#2c3438",
      primary: "#0f5566",
      primaryHover: "#0a3b47",
      border: "#e4e7e8",
      input: "#d3d8da",
      muted: "#f3f5f5",
      accent: "#e6eaeb",
      surface: "#fafbfb",
      rowHover: "#f4f7f7",
      rowSelected: "#eef5f6",
      pill: "#eef0f0",
      destructive: "#b3261e",
      warning: "#8a5a12",
      avatar: "#b06223", // the design's #d4762a darkened for AA (author decision, 2026-11-01)
    });
  });

  it("has a status colour pair for each order status", async () => {
    const { statusColors } = await import("@/lib/theme/palette");
    expect(statusColors).toEqual({
      new: { bg: "#e8eef8", fg: "#2b4f8a" },
      complete: { bg: "#e3f2ea", fg: "#1f6b45" },
      archived: { bg: "#eef0f0", fg: "#5e686d" },
    });
  });
});

describe("06 AC-2 contrast", () => {
  const REQUIRED = [
    "body text",
    "secondary text",
    "subtle text on white",
    "subtle text on surface",
    "subtle text on sidebar",
    "subtle text on selected row",
    "label on surface",
    "label on sidebar",
    "link on white",
    "link on selected row",
    "primary button",
    "overdue text",
    "warning text",
    "count pill",
    "status pill new",
    "status pill complete",
    "status pill archived",
  ];

  it("lists every body-size pair the design uses", async () => {
    const { contrastPairs } = await import("@/lib/theme/palette");
    expect(contrastPairs.filter((p) => !p.largeTextOnly).map((p) => p.name)).toEqual(expect.arrayContaining(REQUIRED));
  });

  it("every body-size text/background pair meets WCAG AA (4.5:1)", async () => {
    const { contrastPairs } = await import("@/lib/theme/palette");
    for (const p of contrastPairs.filter((x) => !x.largeTextOnly)) {
      expect(contrast(p.foreground, p.background), p.name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("the status pills use the statusColors values", async () => {
    const { contrastPairs, statusColors } = await import("@/lib/theme/palette");
    for (const s of ["new", "complete", "archived"] as const) {
      const pair = contrastPairs.find((p) => p.name === `status pill ${s}`);
      expect(pair).toMatchObject({ foreground: statusColors[s].fg, background: statusColors[s].bg });
    }
  });
});
