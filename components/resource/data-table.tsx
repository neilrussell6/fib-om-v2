"use client";

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryStates } from "nuqs";
import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ColumnDef } from "@/lib/resources/types";
import { formatValue } from "./format";

type Row = Record<string, unknown>;

// TanStack Table v9: features and the column helper live at module scope (stable inputs).
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, Row>();

/**
 * Server-rendered list table (spec 02): sortable headers (a second click
 * toggles direction), row click opens the detail page, an Edit action per row,
 * no bulk selection. Sorting and paging happen on the server.
 */
export function DataTable({
  columns,
  rows,
  path,
  sort,
  dir,
}: {
  columns: ColumnDef[];
  rows: Row[];
  path: string;
  sort: string;
  dir: "asc" | "desc";
}) {
  const router = useRouter();
  const [, setQuery] = useQueryStates({ sort: parseAsString, dir: parseAsString, page: parseAsString }, { shallow: false });

  const tableColumns = useMemo(
    () =>
      helper.columns(
        columns.map((c) =>
          helper.accessor((r) => r[c.key], {
            id: c.key,
            header: c.label,
            cell: ({ row }) => {
          const text = formatValue(row.original[c.key], c.format, c.options);
          if (c.link && row.original[c.link.idKey]) {
            return (
              <Link href={`${c.link.path}/${row.original[c.link.idKey]}`} onClick={(e) => e.stopPropagation()} className="text-primary-dark underline-offset-2 hover:underline">
                {text}
              </Link>
            );
          }
              return text;
            },
          }),
        ),
      ),
    [columns],
  );

  // Sorting and paging are done by the server; the table only renders the page it was given.
  const table = useTable({ features, columns: tableColumns, data: rows });

  const toggleSort = (key: string) => {
    const next = sort === key && dir === "asc" ? "desc" : "asc";
    setQuery({ sort: key, dir: next, page: null });
  };

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => {
                const active = sort === h.column.id;
                return (
                  <TableHead key={h.id} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
                    <button type="button" onClick={() => toggleSort(h.column.id)} className="inline-flex items-center gap-1 font-semibold">
                      <table.FlexRender header={h} />
                      {active ? (
                        dir === "asc" ? <ArrowUpIcon aria-hidden="true" className="size-3.5" /> : <ArrowDownIcon aria-hidden="true" className="size-3.5" />
                      ) : (
                        <ArrowUpDownIcon aria-hidden="true" className="size-3.5 opacity-40" />
                      )}
                    </button>
                  </TableHead>
                );
              })}
              <TableHead className="print:hidden">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((r) => {
              const href = `${path}/${r.original.id}`;
              return (
                <TableRow key={String(r.original.id)} onClick={() => router.push(href)} className="cursor-pointer">
                  {r.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                  <TableCell className="text-right print:hidden">
                    <Link href={`${href}/edit`} onClick={(e) => e.stopPropagation()} className="text-primary-dark underline-offset-2 hover:underline">
                      Edit
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length + 1} className="text-center text-muted-foreground">
                No results
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
