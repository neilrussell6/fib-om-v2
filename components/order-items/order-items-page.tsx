import { LinkButton } from "@/components/resource/link-button";
import { PageHeader } from "@/components/resource/page-header";
import { NotFoundToast } from "@/components/resource/not-found-toast";
import { first, listParamsFromUrl, queryWithout, type SearchParams } from "@/components/resource/pages";
import { isId } from "@/lib/ids";
import { StatusTabs } from "@/components/resource/status-tabs";
import { FilterBar } from "@/components/resource/filter-bar";
import { Pagination } from "@/components/resource/pagination";
import { countByStatus, listRecords } from "@/lib/db/list-query";
import { getOrderItemPanel } from "@/lib/order-items/panel-queries";
import { getResource, ORDER_STATUS, resourceNewLabel, resourceTitle } from "@/lib/resources";
import { OrderItemPanel, type PanelData } from "./order-item-panel";
import { OrderItemsTable } from "./order-items-table";

/**
 * The Order Items list (spec 06): status tabs with counts, the design's columns,
 * and the edit panel on the right when `?item=<id>` is set.
 */
export async function OrderItemsListPage({ searchParams }: { searchParams: SearchParams }) {
  const ui = getResource("order_items");
  const sp = await searchParams;
  const params = listParamsFromUrl("order_items", sp);
  const statusParam = first(sp.status);
  const status = ORDER_STATUS.some((o) => o.value === statusParam) ? statusParam! : "";
  const itemParam = first(sp.item);
  const [result, counts, panel] = await Promise.all([
    listRecords("order_items", { ...params, status: status || undefined }),
    countByStatus("order_items", params.filters),
    isId(itemParam) ? getOrderItemPanel(itemParam) : Promise.resolve(null),
  ]);
  const notFound = isId(itemParam) && !panel;
  const baseQuery = queryWithout(sp, "item");

  return (
    <div className="order-items -mx-4 -mt-7 -mb-4 flex h-[calc(100%+2.75rem)] md:-mx-8" data-panel-open={panel ? "" : undefined}>
      <div className="flex min-w-0 flex-1 flex-col px-4 pt-7 md:px-8">
        <PageHeader title={resourceTitle(ui)}>
          <LinkButton href={`${ui.path}/new`} variant="default">
            {resourceNewLabel(ui)}
          </LinkButton>
        </PageHeader>
        <StatusTabs counts={counts} active={status} options={ORDER_STATUS} />
        <FilterBar filters={ui.list.filters} />
        <OrderItemsTable
          columns={ui.list.columns}
          rows={result.rows}
          sort={result.sort}
          dir={result.dir}
          baseQuery={baseQuery}
          selectedId={panel ? String(panel.id) : null}
          panelOpen={Boolean(panel)}
        />
        <Pagination total={result.total} page={result.page} pageSize={result.pageSize} />
      </div>
      {panel ? <OrderItemPanel key={String(panel.id)} data={panel as PanelData} baseQuery={baseQuery} activeStatus={status} /> : null}
      {notFound ? <NotFoundToast label="Order item" /> : null}
    </div>
  );
}
