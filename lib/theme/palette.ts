/**
 * The web3 palette (spec 01, Theme). app/globals.css mirrors these values as
 * CSS variables; tests/unit/theme-contrast.test.ts checks the pairs below.
 */
export const palette = {
  primary: "#0780b0",
  primaryLight: "#11b0f1",
  primaryDark: "#004f6e",
  secondary: "#2c2c2c",
  text: "#676767",
  /** Too light for body text on white (2.9:1): large or decorative text only. */
  mutedLarge: "#919191",
  frame: "#8e989b",
  frameText: "#1f1f1f",
  activeNav: "#284e5d",
  activeNavText: "#ffffff",
  background: "#ffffff",
  white: "#ffffff",
} as const;

export type ContrastPair = {
  name: string;
  foreground: string;
  background: string;
  /** True when the pair is only used for large (≥ 18.66px bold / 24px) or decorative text. */
  largeTextOnly?: boolean;
};

/**
 * Text/background pairs actually used in the UI. White on #0780b0 is 4.45:1,
 * just under AA, so primary buttons use the dark primary (#004f6e) and
 * #0780b0 is kept for accents, focus rings and large text.
 */
export const contrastPairs: ContrastPair[] = [
  { name: "body text", foreground: palette.text, background: palette.background },
  { name: "muted text", foreground: palette.text, background: palette.background },
  { name: "large muted text", foreground: palette.mutedLarge, background: palette.background, largeTextOnly: true },
  { name: "primary button", foreground: palette.white, background: palette.primaryDark },
  { name: "secondary button", foreground: palette.white, background: palette.secondary },
  { name: "sidebar and top bar text", foreground: palette.frameText, background: palette.frame },
  { name: "active sidebar item", foreground: palette.activeNavText, background: palette.activeNav },
];
