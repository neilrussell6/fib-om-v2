import { describe, expect, it } from "vitest";

// AC-12 (palette) and AC-13 (WCAG AA contrast for body text, muted text at body size, buttons).
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

describe("AC-12 palette", () => {
  it("uses the web3 palette", async () => {
    const { palette } = await import("@/lib/theme/palette");
    expect(palette).toMatchObject({
      primary: "#0780b0",
      primaryLight: "#11b0f1",
      primaryDark: "#004f6e",
      secondary: "#2c2c2c",
      text: "#676767",
      frame: "#8e989b",
      activeNav: "#284e5d",
      activeNavText: "#ffffff",
      background: "#ffffff",
    });
  });
});

describe("AC-13 contrast", () => {
  it("every body-size text/background pair meets WCAG AA (4.5:1)", async () => {
    const { contrastPairs } = await import("@/lib/theme/palette");
    const bodySize = contrastPairs.filter((p) => !p.largeTextOnly);
    expect(bodySize.map((p) => p.name)).toEqual(
      expect.arrayContaining(["body text", "muted text", "primary button", "secondary button"]),
    );
    for (const p of bodySize) {
      expect(contrast(p.foreground, p.background), p.name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("never uses #919191 for body-size text", async () => {
    const { contrastPairs } = await import("@/lib/theme/palette");
    for (const p of contrastPairs.filter((p) => !p.largeTextOnly)) {
      expect(p.foreground.toLowerCase(), p.name).not.toBe("#919191");
    }
  });
});
