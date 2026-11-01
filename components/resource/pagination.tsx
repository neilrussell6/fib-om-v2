"use client";

import { parseAsString, useQueryStates } from "nuqs";
import { useId } from "react";

const SIZES = [10, 25, 50, 100];

/** List footer (spec 06): "Showing a–b of n", Prev/Next and the page size (10/25/50/100, default 25). */
export function Pagination({ total, page, pageSize }: { total: number; page: number; pageSize: number }) {
  const [, setQuery] = useQueryStates({ page: parseAsString, pageSize: parseAsString }, { shallow: false });
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const sizeId = useId();
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const nav = "rounded-sm px-1 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-3 text-[13px] text-muted-foreground print:hidden">
      <p>{total === 0 ? "No results" : `Showing ${from}–${to} of ${total}`}</p>
      <div className="flex items-center gap-4">
        <label htmlFor={sizeId} className="flex items-center gap-2">
          Rows per page
          <select
            id={sizeId}
            value={String(pageSize)}
            onChange={(e) => setQuery({ pageSize: e.target.value === "25" ? null : e.target.value, page: null })}
            className="h-7 rounded-md border border-input bg-background px-1.5 text-foreground"
          >
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button type="button" aria-label="Previous page" className={nav} disabled={page <= 1} onClick={() => setQuery({ page: page - 1 <= 1 ? null : String(page - 1) })}>
          ‹ Prev
        </button>
        <button type="button" aria-label="Next page" className={nav} disabled={page >= pages} onClick={() => setQuery({ page: String(page + 1) })}>
          Next ›
        </button>
      </div>
    </div>
  );
}
