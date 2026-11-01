"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { DataTable, type Row } from "@/components/resource/data-table";
import { formatDate } from "@/components/resource/format";
import { DUE_TONE_CLASS, relativeDue } from "@/lib/order-items/relative-due";
import type { ColumnDef } from "@/lib/resources/types";
import { cn } from "@/lib/utils";
import { StatusPill } from "./status-pill";

/** `?<query>&item=<id>` for the current list (other params kept). */
export const itemHref = (baseQuery: string, id: string) => `/order-items?${baseQuery ? `${baseQuery}&` : ""}item=${id}`;

/**
 * The order-items table (spec 06): a row click or the Order link opens the edit
 * panel (`?item=`) instead of the detail page; Due shows a relative line; Status
 * is a pill; Size and Qty are optional beside the panel.
 */
export function OrderItemsTable({
  columns,
  rows,
  sort,
  dir,
  baseQuery,
  selectedId,
  panelOpen,
}: {
  columns: ColumnDef[];
  rows: Row[];
  sort: string;
  dir: "asc" | "desc";
  /** The current list query without `item`. */
  baseQuery: string;
  selectedId: string | null;
  panelOpen: boolean;
}) {
  const router = useRouter();
  const renderCell = useMemo(
    () => ({
      order_number: (r: Row) => (
        <Link
          href={itemHref(baseQuery, String(r.id))}
          scroll={false}
          data-item-link={String(r.id)}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-[13px] text-muted-foreground no-underline hover:text-primary hover:underline"
        >
          {String(r.order_number ?? "")}
        </Link>
      ),
      product_name: (r: Row) => <span title={String(r.product_name ?? "")}>{String(r.product_name ?? "")}</span>,
      product_size_name: (r: Row) => <span className="text-muted-foreground">{String(r.product_size_name ?? "")}</span>,
      order_due_date: (r: Row) => {
        const rel = relativeDue(r.due_in_days as string | number | null, String(r.order_status));
        return (
          <div className="flex flex-col leading-tight">
            <span>{formatDate(r.order_due_date)}</span>
            {rel.text ? <span className={cn("text-xs", DUE_TONE_CLASS[rel.tone])}>{rel.text}</span> : null}
          </div>
        );
      },
      order_status: (r: Row) => <StatusPill status={String(r.order_status)} />,
    }),
    [baseQuery],
  );

  return (
    <DataTable
      columns={columns}
      rows={rows}
      path="/order-items"
      sort={sort}
      dir={dir}
      onRowOpen={(id) => router.push(itemHref(baseQuery, id), { scroll: false })}
      selectedId={selectedId}
      optionalColumns={["product_size_name", "quantity"]}
      renderCell={renderCell}
      minWidth={panelOpen ? 600 : 880}
    />
  );
}
