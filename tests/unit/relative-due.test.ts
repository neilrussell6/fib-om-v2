import { describe, expect, it } from "vitest";

// Spec 06 AC-15: the Due cell's relative line.
describe("06 AC-15 relativeDue", () => {
  it.each([
    [-2, "new", "2d overdue", "overdue"],
    [-1, "new", "1d overdue", "overdue"],
    [0, "new", "due today", "soon"],
    [1, "new", "in 1d", "soon"],
    [7, "new", "in 7d", "soon"],
    [8, "new", "in 8d", "later"],
    [18, "new", "in 18d", "later"],
    [-5, "complete", "—", "done"],
    [3, "archived", "—", "done"],
  ] as const)("%i days, %s → %s (%s)", async (days, status, text, tone) => {
    const { relativeDue } = await import("@/lib/order-items/relative-due");
    expect(relativeDue(days, status)).toEqual({ text, tone });
  });

  it("accepts the numeric string Postgres returns", async () => {
    const { relativeDue } = await import("@/lib/order-items/relative-due");
    expect(relativeDue("-3", "new")).toEqual({ text: "3d overdue", tone: "overdue" });
  });

  it("uses Australia/Brisbane as the app time zone", async () => {
    const { APP_TIME_ZONE } = await import("@/lib/time");
    expect(APP_TIME_ZONE).toBe("Australia/Brisbane");
  });
});
