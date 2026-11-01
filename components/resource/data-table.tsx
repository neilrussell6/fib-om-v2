"use client";

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryStates } from "nuqs";
import { useMemo } from "react";
import type { ColumnDef } from "@/lib/resources/types";
import { cn } from "@/lib/utils";
import { formatValue } from "./format";

export type Row = Record<string, unknown>;

// TanStack Table v9: features and the column helper live at module scope (stable inputs).
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, Row>();

const LINK = "text-primary no-underline underline-offset-2 hover:text-primary-hover hover:underline";

/**
 * Server-rendered list table (spec 02, restyled in spec 06): sortable headers
 * (a second click toggles direction), sticky header row, no bulk selection.
 * By default a row click opens the detail page and each row has an Edit link;
 * with `onRowOpen` (order items) a row click calls it instead and there is no
 * Edit column. Sorting and paging happen on the server.
 */
export function DataTable({
  columns,
  rows,
  path,
  sort,
  dir,
  onRowOpen,
  selectedId,
  optionalColumns = [],
  renderCell = {},
  minWidth,
}: {
  columns: ColumnDef[];
  rows: Row[];
  path: string;
  sort: string;
  dir: "asc" | "desc";
  onRowOpen?: (id: string) => void;
  selectedId?: string | null;
  /** Columns that get the `col-optional` class (hidden beside the order-item panel). */
  optionalColumns?: string[];
  /** Custom cell content per column key. */
  renderCell?: Record<string, (row: Row) => React.ReactNode>;
  minWidth?: number;
}) {
  const router = useRouter();
  const [, setQuery] = useQueryStates({ sort: parseAsString, dir: parseAsString, page: parseAsString }, { shallow: false });

  // The record's own identifying cell: the first column that doesn't link elsewhere.
  // It's a real link, so keyboard users can open the detail page (review 02, finding 3).
  const primaryKey = columns.find((c) => !c.link)?.key;

  const tableColumns = useMemo(
    () =>
      helper.columns(
        columns.map((c) =>
          helper.accessor((r) => r[c.key], {
            id: c.key,
            header: c.label,
            cell: ({ row }) => {
              const custom = renderCell[c.key];
              if (custom) return custom(row.original);
              const text = formatValue(row.original[c.key], c.format, c.options);
              if (c.link && row.original[c.link.idKey]) {
                return (
                  <Link href={`${c.link.path}/${row.original[c.link.idKey]}`} onClick={(e) => e.stopPropagation()} className={LINK}>
                    {text}
                  </Link>
                );
              }
              if (c.key === primaryKey) {
                return (
                  <Link href={`${path}/${row.original.id}`} onClick={(e) => e.stopPropagation()} className={cn(LINK, "font-medium")}>
                    {text || "(blank)"}
                  </Link>
                );
              }
              return text;
            },
          }),
        ),
      ),
    [columns, path, primaryKey, renderCell],
  );

  // Sorting and paging are done by the server; the table only renders the page it was given.
  const table = useTable({ features, columns: tableColumns, data: rows });

  const toggleSort = (key: string) => {
    const next = sort === key && dir === "asc" ? "desc" : "asc";
    setQuery({ sort: key, dir: next, page: null });
  };

  const align = (key: string) => (columns.find((c) => c.key === key)?.align === "right" ? "text-right tabular-nums" : "text-left");
  const optional = (key: string) => (optionalColumns.includes(key) ? "col-optional" : "");
  const showEdit = !onRowOpen;

  return (
    <div className="min-h-0 flex-1 overflow-auto print:overflow-visible">
      <table className="w-full border-separate border-spacing-0 text-sm" style={minWidth ? { minWidth } : undefined}>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => {
                const active = sort === h.column.id;
                return (
                  <th
                    key={h.id}
                    aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
                    className={cn(
                      "sticky top-0 z-[1] border-b border-border bg-surface px-3 py-2.5 text-xs font-normal tracking-[0.06em] whitespace-nowrap text-subtle-foreground uppercase",
                      align(h.column.id),
                      optional(h.column.id),
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(h.column.id)}
                      className="inline-flex items-center gap-1 uppercase outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <table.FlexRender header={h} />
                      {active ? (
                        dir === "asc" ? <ArrowUpIcon aria-hidden="true" className="size-3" /> : <ArrowDownIcon aria-hidden="true" className="size-3" />
                      ) : null}
                    </button>
                  </th>
                );
              })}
              {showEdit ? (
                <th className="sticky top-0 z-[1] border-b border-border bg-surface px-3 py-2.5 print:hidden">
                  <span className="sr-only">Actions</span>
                </th>
              ) : null}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((r) => {
              const id = String(r.original.id);
              const href = `${path}/${id}`;
              const selected = selectedId != null && selectedId === id;
              return (
                <tr
                  key={id}
                  onClick={() => (onRowOpen ? onRowOpen(id) : router.push(href))}
                  aria-selected={onRowOpen ? selected : undefined}
                  className={cn(
                    "h-12 cursor-pointer hover:bg-row-hover",
                    selected && "bg-row-selected shadow-[inset_3px_0_0_var(--primary)] hover:bg-row-selected",
                  )}
                >
                  {r.getAllCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        "max-w-[22rem] truncate border-b border-pill px-3 whitespace-nowrap",
                        align(cell.column.id),
                        optional(cell.column.id),
                      )}
                    >
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                  {showEdit ? (
                    <td className="border-b border-pill px-3 text-right print:hidden">
                      <Link href={`${href}/edit`} onClick={(e) => e.stopPropagation()} className={LINK}>
                        Edit
                      </Link>
                    </td>
                  ) : null}
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={columns.length + (showEdit ? 1 : 0)} className="border-b border-pill px-3 py-6 text-center text-muted-foreground">
                No results
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
