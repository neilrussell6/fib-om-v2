import type { Option } from "@/lib/resources/types";

/** "2026-12-24" → "24 Dec 2026" (dates are stored and passed as plain YYYY-MM-DD strings). */
export function formatDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(value)) return value == null ? "" : String(value);
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export function formatValue(value: unknown, kind?: string, options?: Option[]): string {
  if (value === null || value === undefined || value === "") return "";
  if (kind === "date") return formatDate(value);
  if (kind === "boolean") return value ? "Yes" : "No";
  if ((kind === "enum" || kind === "select") && options) return options.find((o) => o.value === String(value))?.label ?? String(value);
  return String(value);
}
