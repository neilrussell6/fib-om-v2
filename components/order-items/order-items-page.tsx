import type { SearchParams } from "@/components/resource/list-params";
import { ResourceListPage } from "@/components/resource/pages";
import { getOrderItemPanel } from "@/lib/order-items/panel-queries";
import { getResource } from "@/lib/resources";
import { OrderItemCreateForm } from "./order-item-create-form";
import { OrderItemPanel, type PanelData } from "./order-item-panel";
import { OrderItemsTable } from "./order-items-table";

/**
 * The Order Items list (spec 06): status tabs with counts, the design's columns,
 * and the edit panel on the right when `?item=<id>` is set. It loads like every
 * other list (spec 09) and brings its own table, panel and create dialog.
 */
export function OrderItemsListPage({ searchParams }: { searchParams: SearchParams }) {
  const ui = getResource("order_items");
  return (
    <ResourceListPage
      resourceKey="order_items"
      searchParams={searchParams}
      className="order-items"
      panelAttr="data-panel-open"
      loadRecord={(id) => getOrderItemPanel(id)}
      renderTable={(p) => (
        <OrderItemsTable
          columns={ui.list.columns}
          rows={p.rows}
          sort={p.sort}
          dir={p.dir}
          baseQuery={p.baseQuery}
          selectedId={p.selectedId}
          panelOpen={p.selectedId !== null}
        />
      )}
      renderPanel={(record, p) => (
        <OrderItemPanel key={String(record.id)} data={record as PanelData} baseQuery={p.baseQuery} activeStatus={p.activeStatus} covered={p.covered} />
      )}
      renderCreate={(p) => <OrderItemCreateForm baseQuery={p.baseQuery} />}
    />
  );
}
