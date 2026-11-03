import { describe, expect, it } from "vitest";
import { formatDate, formatValue } from "@/components/resource/format";

// Spec 09 Tests and CI: the cell and detail value formatting.
describe("09 format formatDate", () => {
  it("formats a YYYY-MM-DD date as day, short month and year", () => {
    expect(formatDate("2026-12-24")).toBe("24 Dec 2026");
  });

  it("uses the date part of a timestamp, with no time zone shift", () => {
    expect(formatDate("2026-01-01T23:30:00Z")).toBe("01 Jan 2026");
  });

  it("leaves other values as text, and null as empty", () => {
    expect(formatDate("not a date")).toBe("not a date");
    expect(formatDate(5)).toBe("5");
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
  });
});

describe("09 format formatValue", () => {
  const options = [
    { value: "new", label: "New" },
    { value: "complete", label: "Complete" },
  ];

  it("is empty for null, undefined and empty string", () => {
    expect(formatValue(null)).toBe("");
    expect(formatValue(undefined)).toBe("");
    expect(formatValue("")).toBe("");
  });

  it("formats dates and booleans", () => {
    expect(formatValue("2026-12-24", "date")).toBe("24 Dec 2026");
    expect(formatValue(true, "boolean")).toBe("Yes");
    expect(formatValue(false, "boolean")).toBe("No");
  });

  it("maps enum and select values to their labels, falling back to the value", () => {
    expect(formatValue("complete", "enum", options)).toBe("Complete");
    expect(formatValue("new", "select", options)).toBe("New");
    expect(formatValue("archived", "enum", options)).toBe("archived");
  });

  it("stringifies anything else", () => {
    expect(formatValue(42)).toBe("42");
    expect(formatValue("text", "text")).toBe("text");
    expect(formatValue("complete", "enum")).toBe("complete");
  });
});
