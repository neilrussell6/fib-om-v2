/**
 * The "Order Items" design palette (spec 06, Theme). app/globals.css mirrors
 * these values as CSS variables; tests/unit/theme-contrast.test.ts checks the pairs below.
 */
export const palette = {
  background: "#ffffff",
  white: "#ffffff",
  foreground: "#1d2326",
  secondaryText: "#5e686d",
  /** The design's #7d878b / #8a9397 text greys darkened to pass WCAG AA on every design surface. */
  subtle: "#697175",
  /** Decorative chevrons and icons only (aria-hidden): 3.1:1 on white, not for text. */
  iconMuted: "#8a9397",
  label: "#2c3438",
  primary: "#0f5566",
  primaryHover: "#0a3b47",
  border: "#e4e7e8",
  input: "#d3d8da",
  dashed: "#c3c9cc",
  muted: "#f3f5f5",
  accent: "#e6eaeb",
  surface: "#fafbfb",
  rowHover: "#f4f7f7",
  rowSelected: "#eef5f6",
  pill: "#eef0f0",
  destructive: "#b3261e",
  warning: "#8a5a12",
  /** The design's #d4762a darkened so the white initial passes AA (3.27:1 → 4.55:1). */
  avatar: "#b06223",
} as const;

/** Order status pill colours (bg / fg), keyed by order_status value (spec 06). */
export const statusColors = {
  new: { bg: "#e8eef8", fg: "#2b4f8a" },
  complete: { bg: "#e3f2ea", fg: "#1f6b45" },
  archived: { bg: "#eef0f0", fg: "#5e686d" },
} as const;

export type StatusKey = keyof typeof statusColors;

export type ContrastPair = {
  name: string;
  foreground: string;
  background: string;
  /** True when the pair is only used for large (≥ 18.66px bold / 24px) or decorative text. */
  largeTextOnly?: boolean;
};

/** Text/background pairs actually used in the UI; every body-size pair must reach 4.5:1. */
export const contrastPairs: ContrastPair[] = [
  { name: "body text", foreground: palette.foreground, background: palette.background },
  { name: "secondary text", foreground: palette.secondaryText, background: palette.background },
  { name: "subtle text on white", foreground: palette.subtle, background: palette.background },
  { name: "subtle text on surface", foreground: palette.subtle, background: palette.surface },
  { name: "subtle text on sidebar", foreground: palette.subtle, background: palette.muted },
  { name: "subtle text on selected row", foreground: palette.subtle, background: palette.rowSelected },
  { name: "secondary text on selected row", foreground: palette.secondaryText, background: palette.rowSelected },
  { name: "secondary text on read-only field", foreground: palette.secondaryText, background: palette.muted },
  { name: "label on surface", foreground: palette.label, background: palette.surface },
  { name: "label on sidebar", foreground: palette.label, background: palette.muted },
  { name: "label on hover", foreground: palette.label, background: palette.accent },
  { name: "link on white", foreground: palette.primary, background: palette.background },
  { name: "link on surface", foreground: palette.primary, background: palette.surface },
  { name: "link on selected row", foreground: palette.primary, background: palette.rowSelected },
  { name: "primary button", foreground: palette.white, background: palette.primary },
  { name: "active sidebar item", foreground: palette.white, background: palette.primary },
  { name: "avatar initial", foreground: palette.white, background: palette.avatar },
  { name: "overdue text", foreground: palette.destructive, background: palette.background },
  { name: "warning text", foreground: palette.warning, background: palette.background },
  { name: "count pill", foreground: palette.secondaryText, background: palette.pill },
  { name: "status pill new", foreground: statusColors.new.fg, background: statusColors.new.bg },
  { name: "status pill complete", foreground: statusColors.complete.fg, background: statusColors.complete.bg },
  { name: "status pill archived", foreground: statusColors.archived.fg, background: statusColors.archived.bg },
];
