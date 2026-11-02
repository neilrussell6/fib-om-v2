import { DUE_TONE_CLASS, relativeDue } from "@/lib/order-items/relative-due";
import type { Option } from "@/lib/resources";
import { cn } from "@/lib/utils";
import type { Row } from "./data-table";
import { formatDate } from "./format";
import { StatusPill } from "./status-pill";

/** A due date with its relative line (spec 06 AC-15; orders since spec 07 AC-5). */
export function DueCell({ date, dueInDays, status }: { date: unknown; dueInDays: unknown; status: string }) {
  const rel = relativeDue(dueInDays as string | number | null, status);
  return (
    <div className="flex flex-col leading-tight">
      <span>{formatDate(date)}</span>
      {rel.text ? <span className={cn("text-xs", DUE_TONE_CLASS[rel.tone])}>{rel.text}</span> : null}
    </div>
  );
}

/** A cell renderer for a status pill column. */
export function pillCell(key: string, options: Option[]) {
  return function PillCell(r: Row) {
    return <StatusPill status={String(r[key])} options={options} />;
  };
}
