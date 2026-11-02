"use client";

import { useMemo } from "react";
import { DueCell, pillCell } from "@/components/resource/cells";
import { DataTable, type Row } from "@/components/resource/data-table";
import { ORDER_STATUS } from "@/lib/resources";
import type { ColumnDef } from "@/lib/resources/types";

/**
 * The order-items table (spec 06): a row click or the Order link opens the edit
 * panel (`?item=`) instead of the detail page; Due shows a relative line; Status
 * is a pill; Size and Qty are optional beside the panel. The panel link and
 * history handling are DataTable's (spec 07).
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
  const renderCell = useMemo(
    () => ({
      product_name: (r: Row) => <span title={String(r.product_name ?? "")}>{String(r.product_name ?? "")}</span>,
      product_size_name: (r: Row) => <span className="text-muted-foreground">{String(r.product_size_name ?? "")}</span>,
      order_due_date: (r: Row) => <DueCell date={r.order_due_date} dueInDays={r.due_in_days} status={String(r.order_status)} />,
      order_status: pillCell("order_status", ORDER_STATUS),
    }),
    [],
  );
  const panel = useMemo(
    () => ({
      titleKey: "order_number",
      title: (r: Row) => String(r.order_number ?? ""),
      baseQuery,
      linkClassName: "font-mono text-[13px] text-muted-foreground no-underline hover:text-primary hover:underline",
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
      panel={panel}
      selectedId={selectedId}
      optionalColumns={["product_size_name", "quantity"]}
      renderCell={renderCell}
      minWidth={panelOpen ? 600 : 880}
    />
  );
}
