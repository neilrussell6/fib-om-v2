/** The Due cell's relative line (spec 06): overdue in red, within a week in amber, later in grey. */
export type DueTone = "overdue" | "soon" | "later" | "done";

const DONE_STATUSES = new Set(["complete", "archived"]);

/**
 * `dueInDays` is the order's due date minus today in the app's time zone (computed
 * in SQL, so server and client agree). Complete and archived orders show "—".
 */
export function relativeDue(dueInDays: number | string | null | undefined, status: string): { text: string; tone: DueTone } {
  if (DONE_STATUSES.has(status)) return { text: "—", tone: "done" };
  const d = Number(dueInDays);
  if (dueInDays === null || dueInDays === undefined || !Number.isFinite(d)) return { text: "", tone: "later" };
  if (d < 0) return { text: `${-d}d overdue`, tone: "overdue" };
  if (d === 0) return { text: "due today", tone: "soon" };
  return { text: `in ${d}d`, tone: d <= 7 ? "soon" : "later" };
}

/** Tailwind text colour per tone. */
export const DUE_TONE_CLASS: Record<DueTone, string> = {
  overdue: "text-destructive",
  soon: "text-warning",
  later: "text-muted-foreground",
  done: "text-subtle-foreground",
};
