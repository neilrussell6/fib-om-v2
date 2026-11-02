"use client";

import { useMemo } from "react";
import { getResource, recordTitle, type ResourceKey } from "@/lib/resources";
import { pillCell, DueCell } from "./cells";
import { DataTable, type Row } from "./data-table";

/** Per-resource cells (spec 07): status pills, and the relative Due line on orders. */
function cellsFor(key: ResourceKey): Record<string, (row: Row) => React.ReactNode> {
  const ui = getResource(key);
  const cells: Record<string, (row: Row) => React.ReactNode> = {};
  const tabs = ui.list.statusTabs;
  if (tabs) cells[tabs.key] = pillCell(tabs.key, tabs.options);
  if (key === "orders") {
    cells.due_date = (r) => <DueCell date={r.due_date} dueInDays={r.due_in_days} status={String(r.status)} />;
  }
  return cells;
}

/** A generic list's table with click-to-edit (spec 07). */
export function ResourceTable({
  resourceKey,
  rows,
  sort,
  dir,
  baseQuery,
  selectedId,
}: {
  resourceKey: ResourceKey;
  rows: Row[];
  sort: string;
  dir: "asc" | "desc";
  baseQuery: string;
  selectedId: string | null;
}) {
  const ui = getResource(resourceKey);
  const renderCell = useMemo(() => cellsFor(resourceKey), [resourceKey]);
  const panel = useMemo(
    () => ({ titleKey: ui.titleField, title: (r: Row) => recordTitle(ui, r), baseQuery }),
    [ui, baseQuery],
  );
  return (
    <DataTable
      columns={ui.list.columns}
      rows={rows}
      path={ui.path}
      sort={sort}
      dir={dir}
      panel={panel}
      selectedId={selectedId}
      renderCell={renderCell}
    />
  );
}
