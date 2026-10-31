"use client";

import { parseAsString, useQueryStates } from "nuqs";
import { Button } from "@/components/ui/button";

const SIZES = [10, 25, 50, 100];

/** Page sizes 10/25/50/100 (default 25) and the total row count (spec 02). */
export function Pagination({ total, page, pageSize }: { total: number; page: number; pageSize: number }) {
  const [, setQuery] = useQueryStates({ page: parseAsString, pageSize: parseAsString }, { shallow: false });
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm print:hidden">
      <p>Total: {total}</p>
      <div className="flex items-center gap-3">
        <label htmlFor="page-size" className="flex items-center gap-2">
          Rows per page
          <select
            id="page-size"
            value={String(pageSize)}
            onChange={(e) => setQuery({ pageSize: e.target.value === "25" ? null : e.target.value, page: null })}
            className="h-8 rounded-md border border-input bg-background px-2"
          >
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <span>
          Page {page} of {pages}
        </span>
        <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setQuery({ page: page - 1 <= 1 ? null : String(page - 1) })}>
          Previous page
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={page >= pages} onClick={() => setQuery({ page: String(page + 1) })}>
          Next page
        </Button>
      </div>
    </div>
  );
}
